import cluster, { type ClusterSettings, type Worker } from 'node:cluster';
import os from 'node:os';
import util from 'node:util';
import { logDate } from 'utility';

export interface ForkOptions {
  /**
   * exec file path
   */
  exec?: string;
  execArgv?: string[];
  /**
   * exec arguments
   */
  args?: string[];
  /**
   * slave processes
   */
  slaves?: (string | ClusterSettings)[];
  /**
   * whether or not to send output to parent's stdio, default is `false`
   */
  silent?: boolean;
  /**
   * worker num, default is `os.cpus().length`
   */
  count?: number;
  /**
   * refork when disconnect and unexpected exit, default is `true`
   */
  refork?: boolean;
  /**
   * auto fork with istanbul when `running_under_istanbul` env set, default is `false`
   */
  autoCoverage?: boolean;
  /**
   * Hide the forked processes console window that would normally be created on Windows systems. Default is `false`
   */
  windowsHide?: boolean;
  /**
   * Specify the kind of serialization used for sending messages between processes. Possible values are 'json' and 'advanced'. See Advanced serialization for child_process for more details.
   */
  serialization?: 'json' | 'advanced';
  limit?: number;
  duration?: number;
  /**
   * default env
   */
  env?: any;
}

const CLUSTER_SETTINGS = Symbol('cfork worker cluster settings');
const CLUSTER_ENV = Symbol('cfork worker cluster env');

/**
 * cluster fork
 */
export function fork(options: ForkOptions = {}) {
  if (cluster.isWorker) {
    return;
  }
  const exec = options.exec;
  const count = options.count ?? os.cpus().length;
  const refork = options.refork !== false;
  const limit = options.limit ?? 60;
  const duration = options.duration ?? 60000; // 1 min
  const reforkTimes: number[] = [];
  const attachedEnv = options.env ?? {};
  let newWorker;

  if (exec) {
    const settings = {
      exec,
    } as ClusterSettings;

    if (options.execArgv !== undefined) {
      settings.execArgv = options.execArgv;
    }

    if (options.args !== undefined) {
      settings.args = options.args;
    }
    if (options.silent !== undefined) {
      settings.silent = options.silent;
    }
    if (options.windowsHide !== undefined) {
      settings.windowsHide = options.windowsHide;
    }
    if (options.serialization !== undefined) {
      settings.serialization = options.serialization;
    }

    // https://github.com/gotwarlost/istanbul#multiple-process-usage
    // Multiple Process under istanbul
    if (options.autoCoverage && process.env.running_under_istanbul) {
      // use coverage for forked process
      // disabled reporting and output for child process
      // enable pid in child process coverage filename
      let args = [
        'cover', '--report', 'none', '--print', 'none', '--include-pid',
        exec,
      ];
      if (settings.args && settings.args.length > 0) {
        args.push('--');
        args = args.concat(settings.args);
      }
      settings.exec = './node_modules/.bin/istanbul';
      settings.args = args;
    }

    cluster.setupPrimary(settings);
  }

  const disconnects: Record<number, string> = {};
  let disconnectCount = 0;
  let unexpectedCount = 0;

  cluster.on('disconnect', function(worker) {
    const disableRefork = getDisableRefork(worker);
    const log = console[ disableRefork ? 'info' : 'error'];
    disconnectCount++;
    const isDead = worker.isDead && worker.isDead();
    const propertyName = worker.hasOwnProperty('exitedAfterDisconnect') ? 'exitedAfterDisconnect' : 'suicide';
    const propertyValue = Reflect.get(worker, propertyName);
    const state = Reflect.get(worker, 'state');
    const workerPid = worker.process.pid!;
    const { env } = getSettings(worker);
    const slaveWorkerIndex = env?.CFORK_SLAVE_WORKER_INDEX ?? '';
    const isSlaveWorker = !!slaveWorkerIndex;
    log('[%s] [cfork:master:%s] worker:%s disconnect (%s: %s, state: %s, isDead: %s, worker.disableRefork: %s, isSlave: %s, slaveIndex: %s)',
      logDate(), process.pid, workerPid, propertyName, propertyValue,
      state, isDead, disableRefork,
      isSlaveWorker, slaveWorkerIndex);
    if (isDead) {
      // worker has terminated before disconnect
      log('[%s] [cfork:master:%s] don\'t fork, because worker:%s exit event emit before disconnect',
        logDate(), process.pid, workerPid);
      return;
    }
    if (disableRefork) {
      // worker has terminated by master, like egg-cluster master will set disableRefork to true
      log('[%s] [cfork:master:%s] don\'t fork, because worker:%s will be kill soon',
        logDate(), process.pid, workerPid);
      return;
    }

    disconnects[workerPid] = logDate();
    if (allow()) {
      const { settings, env } = getSettings(worker);
      newWorker = forkWorker(settings, env);
      saveSettings(newWorker, settings, env);
      log('[%s] [cfork:master:%s] new worker:%s fork (state: %s, reforkCount: %d)',
        logDate(), process.pid, newWorker.process.pid, Reflect.get(newWorker, 'state'),
        reforkTimes.length);
    } else {
      log('[%s] [cfork:master:%s] don\'t fork new work (refork: %s, reforkCount: %d)',
        logDate(), process.pid, refork, reforkTimes.length);
    }
  });

  cluster.on('exit', function(worker, code, signal) {
    const disableRefork = getDisableRefork(worker);
    const log = console[disableRefork ? 'info' : 'error'];
    const isDead = worker.isDead && worker.isDead();
    const propertyName = worker.hasOwnProperty('exitedAfterDisconnect') ? 'exitedAfterDisconnect' : 'suicide';
    const propertyValue = Reflect.get(worker, propertyName);
    const state = Reflect.get(worker, 'state');
    const workerPid = worker.process.pid!;
    const isExpected = !!disconnects[workerPid];
    const { env } = getSettings(worker);
    const slaveWorkerIndex = env?.CFORK_SLAVE_WORKER_INDEX ?? '';
    const isSlaveWorker = !!slaveWorkerIndex;
    log('[%s] [cfork:master:%s] worker:%s exit (code: %s, %s: %s, state: %s, isDead: %s, isExpected: %s, worker.disableRefork: %s, isSlave: %s, slaveIndex: %s)',
      logDate(), process.pid, workerPid, code, propertyName, propertyValue,
      state, isDead, isExpected, disableRefork,
      isSlaveWorker, slaveWorkerIndex);
    if (isExpected) {
      delete disconnects[workerPid];
      // worker disconnect first, exit expected
      return;
    }
    if (disableRefork) {
      // worker is killed by master
      return;
    }

    unexpectedCount++;
    if (allow()) {
      const { settings, env } = getSettings(worker);
      newWorker = forkWorker(settings, env);
      saveSettings(newWorker, settings, env);
      log('[%s] [cfork:master:%s] new worker:%s fork (state: %s, reforkCount: %d)',
        logDate(), process.pid, newWorker.process.pid, Reflect.get(newWorker, 'state'),
        reforkTimes.length);
    } else {
      log('[%s] [cfork:master:%s] don\'t fork new work (refork: %s, reforkCount: %d)',
        logDate(), process.pid, refork, reforkTimes.length);
    }
    cluster.emit('unexpectedExit', worker, code, signal);
  });

  // defer to set the listeners
  // so you can listen this by your own
  setImmediate(() => {
    if (process.listeners('uncaughtException').length === 0) {
      process.on('uncaughtException', onerror);
    }
    if (cluster.listeners('unexpectedExit').length === 0) {
      cluster.on('unexpectedExit', onUnexpected);
    }
    if (cluster.listeners('reachReforkLimit').length === 0) {
      cluster.on('reachReforkLimit', onReachReforkLimit);
    }
  });

  for (let i = 0; i < count; i++) {
    const env = { CFORK_WORKER_INDEX: String(i), CFORK_WORKER_COUNT: String(count) };
    newWorker = forkWorker(null, env);
    saveSettings(newWorker, cluster.settings, env);
  }

  // fork slaves after workers are forked
  if (options.slaves) {
    const slaves = Array.isArray(options.slaves) ? options.slaves : [ options.slaves ];
    slaves.map(normalizeSlaveConfig)
      .forEach(function(settings, index) {
        if (settings) {
          const env = {
            CFORK_SLAVE_WORKER_INDEX: String(index),
            CFORK_SLAVE_WORKER_COUNT: String(slaves.length),
          };
          newWorker = forkWorker(settings, env);
          saveSettings(newWorker, settings, env);
        }
      });
  }

  return cluster;

  /**
   * allow refork
   */
  function allow() {
    if (!refork) {
      return false;
    }

    const times = reforkTimes.push(Date.now());

    if (times > limit) {
      reforkTimes.shift();
    }

    const span = reforkTimes[reforkTimes.length - 1] - reforkTimes[0];
    const canFork = reforkTimes.length < limit || span > duration;

    if (!canFork) {
      cluster.emit('reachReforkLimit');
    }

    return canFork;
  }

  /**
   * uncaughtException default handler
   */
  function onerror(err: Error) {
    if (!err) {
      return;
    }
    console.error('[%s] [cfork:master:%s] master uncaughtException: %s',
      logDate(), process.pid, err.stack);
    console.error(err);
    console.error('(total %d disconnect, %d unexpected exit)',
      disconnectCount, unexpectedCount);
  }

  /**
   * unexpectedExit default handler
   */
  function onUnexpected(worker: Worker, code: number, signal: string) {
    const exitCode = worker.process.exitCode || code;
    const propertyName = worker.hasOwnProperty('exitedAfterDisconnect') ? 'exitedAfterDisconnect' : 'suicide';
    const propertyValue = Reflect.get(worker, propertyName);
    const state = Reflect.get(worker, 'state');
    const { env } = getSettings(worker);
    const slaveWorkerIndex = env?.CFORK_SLAVE_WORKER_INDEX ?? '';
    const isSlaveWorker = !!slaveWorkerIndex;
    const err = new Error(util.format('worker:%s died unexpected (code: %s, signal: %s, %s: %s, state: %s, isSalve: %s, salveIndex: %s)',
      worker.process.pid, exitCode, signal, propertyName, propertyValue, state,
      isSlaveWorker, slaveWorkerIndex));
    err.name = 'WorkerDiedUnexpectedError';
    console.error('[%s] [cfork:master:%s] (total %d disconnect, %d unexpected exit) %s',
      logDate(), process.pid, disconnectCount, unexpectedCount, err.stack);
  }

  /**
   * reachReforkLimit default handler
   */
  function onReachReforkLimit() {
    console.error('[%s] [cfork:master:%s] worker died too fast (total %d disconnect, %d unexpected exit)',
      logDate(), process.pid, disconnectCount, unexpectedCount);
  }

  /**
   * normalize slave config
   */
  function normalizeSlaveConfig(options: string | ClusterSettings) {
    // exec path
    if (typeof options === 'string') {
      options = { exec: options };
    }
    if (!options.exec) {
      return null;
    }
    return options;
  }

  /**
   * fork worker with certain settings
   */
  function forkWorker(settings: ClusterSettings | null, workerEnv: any) {
    if (settings) {
      // cluster.settings = settings;
      cluster.setupPrimary(settings);
    }
    return cluster.fork(Object.assign({}, attachedEnv, workerEnv));
  }
}

export const cfork = fork;

/**
 * set disableRefork
 *
 * @param {import('cluster').Worker} worker - worker, Node.js cluster.Worker object
 * @param {boolean} isDisableRefork - the worker process is not refork
 * @return {void}
 */
export function setDisableRefork(worker: Worker, isDisableRefork: boolean): void {
  if (worker) {
    Reflect.set(worker, 'disableRefork', isDisableRefork);
  }
}

/**
 * get disableRefork
 *
 * @param {import('cluster').Worker} worker - worker, Node.js cluster.Worker object
 * @return {boolean} the worker process is not refork
 */
export function getDisableRefork(worker?: Worker): boolean {
  if (worker) {
    return Reflect.get(worker, 'disableRefork') || false;
  }
  return false;
}

function saveSettings(worker: object, settings: ClusterSettings, env: any) {
  Reflect.set(worker, CLUSTER_SETTINGS, settings);
  Reflect.set(worker, CLUSTER_ENV, env);
}

function getSettings(worker: object) {
  return {
    settings: Reflect.get(worker, CLUSTER_SETTINGS) as ClusterSettings,
    env: Reflect.get(worker, CLUSTER_ENV) as any,
  };
}
