'use strict';

var cluster = require('cluster');
var os = require('os');
var util = require('util');

var defer = global.setImmediate || process.nextTick;
var bindEvents = false;

module.exports = fork;

/**
 * cluster fork
 *
 * @param {Object} [options]
 *   - {String} exec       exec file path
 *   - {Array} [args]      exec arguments
 *   - {Array} [slaves]    slave processes
 *   - {Boolean} [silent]  whether or not to send output to parent's stdio, default is `false`
 *   - {Number} [count]    worker num, defualt is `os.cpus().length`
 *   - {Boolean} [refork]  refork when disconect and unexpected exit, default is `true`
 *   - {Boolean} [autoCoverage] auto fork with istanbul when `running_under_istanbul` env set, default is `false`
 * @return {Cluster}
 */

function fork(options) {
  if (cluster.isWorker) {
    return;
  }

  options = options || {};
  var count = options.count || os.cpus().length;
  var refork = options.refork !== false;
  var limit = options.limit || 60;
  var duration = options.duration || 60000; // 1 min
  var reforks = [];
  var attachedEnv = options.env || {};
  var newWorker;

  if (options.exec) {
    var opts = {
      exec: options.exec
    };

    if (options.execArgv !== undefined) {
      opts.execArgv = options.execArgv;
    }

    if (options.args !== undefined) {
      opts.args = options.args;
    }
    if (options.silent !== undefined) {
      opts.silent = options.silent;
    }

    // https://github.com/gotwarlost/istanbul#multiple-process-usage
    // Multiple Process under istanbul
    if (options.autoCoverage && process.env.running_under_istanbul) {
      // use coverage for forked process
      // disabled reporting and output for child process
      // enable pid in child process coverage filename
      var args = [
        'cover', '--report', 'none', '--print', 'none', '--include-pid',
        opts.exec,
      ];
      if (opts.args && opts.args.length > 0) {
        args.push('--');
        args = args.concat(opts.args);
      }

      opts.exec = './node_modules/.bin/istanbul';
      opts.args = args;
    }

    cluster.setupMaster(opts);
  }

  var disconnects = {};
  var disconnectCount = 0;
  var unexpectedCount = 0;

  if (!bindEvents) {
    bindEvents = true;
    cluster.on('disconnect', function (worker) {
      disconnectCount++;
      var isDead = worker.isDead && worker.isDead();
      console.error('[%s] [cfork:master:%s] worker:%s disconnect (suicide: %s, state: %s, isDead: %s)',
        Date(), process.pid, worker.process.pid, worker.suicide, worker.state, isDead);
      if (isDead) {
        // worker has terminated before disconnect
        console.error('[%s] [cfork:master:%s] don\'t fork, because worker:%s exit event emit before disconnect',
          Date(), process.pid, worker.process.pid);
        return;
      }

      disconnects[worker.process.pid] = Date();
      if (allow(worker)) {
        newWorker = forkWorker(worker._clusterSettings);
        newWorker._clusterSettings = worker._clusterSettings;
        console.error('[%s] [cfork:master:%s] new worker:%s fork (state: %s)',
          Date(), process.pid, newWorker.process.pid, newWorker.state);
      } else {
        console.error('[%s] [cfork:master:%s] don\'t fork new work (refork: %s)',
          Date(), process.pid, refork);
      }
    });

    cluster.on('exit', function (worker, code, signal) {
      var isExpected = !!disconnects[worker.process.pid];
      var isDead = worker.isDead && worker.isDead();
      console.error('[%s] [cfork:master:%s] worker:%s exit (code: %s, suicide: %s, state: %s, isDead: %s, isExpected: %s)',
        Date(), process.pid, worker.process.pid, code, worker.suicide, worker.state, isDead, isExpected);
      if (isExpected) {
        delete disconnects[worker.process.pid];
        // worker disconnect first, exit expected
        return;
      }

      unexpectedCount++;
      if (allow(worker)) {
        newWorker = forkWorker(worker._clusterSettings);
        newWorker._clusterSettings = worker._clusterSettings;
        console.error('[%s] [cfork:master:%s] new worker:%s fork (state: %s)',
          Date(), process.pid, newWorker.process.pid, newWorker.state);
      } else {
        console.error('[%s] [cfork:master:%s] don\'t fork new work (refork: %s)',
          Date(), process.pid, refork);
      }
      cluster.emit('unexpectedExit', worker, code, signal);
    });
  }

  // defer to set the listeners
  // so you can listen this by your own
  defer(function () {
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

  for (var i = 0; i < count; i++) {
    newWorker = forkWorker();
    newWorker._clusterSettings = cluster.settings;
  }

  // fork slaves after workers are forked
  if (options.slaves) {
    var slaves = Array.isArray(options.slaves) ? options.slaves : [options.slaves];
    slaves.map(normalizeSlaveConfig)
      .forEach(function(settings) {
        if (settings) {
          newWorker = forkWorker(settings);
          newWorker._clusterSettings = settings;
        }
      });
  }

  return cluster;

  /**
   * allow refork
   */
  function allow(worker) {
    if (!refork) {
      return false;
    }

    if (worker._refork === false) {
      return false;
    }

    var times = reforks.push(Date.now());

    if (times > limit) {
      reforks.shift();
    }

    var span = reforks[reforks.length - 1] - reforks[0];
    var canFork = reforks.length < limit || span > duration;

    if (!canFork) {
      cluster.emit('reachReforkLimit');
    }

    return canFork;
  }

  /**
   * uncaughtException default handler
   */

  function onerror(err) {
    if (!err) {
      return;
    }
    console.error('[%s] [cfork:master:%s] master uncaughtException: %s', Date(), process.pid, err.stack);
    console.error(err);
    console.error('(total %d disconnect, %d unexpected exit)', disconnectCount, unexpectedCount);
  }

  /**
   * unexpectedExit default handler
   */

  function onUnexpected(worker, code, signal) {
    var exitCode = worker.process.exitCode;
    var err = new Error(util.format('worker:%s died unexpected (code: %s, signal: %s, suicide: %s, state: %s)',
      worker.process.pid, exitCode, signal, worker.suicide, worker.state));
    err.name = 'WorkerDiedUnexpectedError';

    console.error('[%s] [cfork:master:%s] (total %d disconnect, %d unexpected exit) %s',
      Date(), process.pid, disconnectCount, unexpectedCount, err.stack);
  }

  /**
   * reachReforkLimit default handler
   */

  function onReachReforkLimit() {
    console.error('[%s] [cfork:master:%s] worker died too fast (total %d disconnect, %d unexpected exit)',
      Date(), process.pid, disconnectCount, unexpectedCount);
  }

  /**
   * normalize slave config
   */
  function normalizeSlaveConfig(opt) {
    // exec path
    if (typeof opt === 'string') {
      opt = { exec: opt };
    }
    if (!opt.exec) {
      return null;
    } else {
      return opt;
    }
  }

  /**
   * fork worker with certain settings
   */
  function forkWorker(settings) {
    if (settings) {
      cluster.settings = settings;
      cluster.setupMaster();
    }
    return cluster.fork(attachedEnv);
  }
}
