/**!
 * cfork - index.js
 *
 * Copyright(c) fengmk2 and other contributors.
 * MIT Licensed
 *
 * Authors:
 *   fengmk2 <fengmk2@gmail.com> (http://fengmk2.github.com)
 */

'use strict';

/**
 * Module dependencies.
 */

var cluster = require('cluster');
var os = require('os');
var util = require('util');

var defer = global.setImmediate || process.nextTick;

module.exports = fork;

/**
 * cluster fork
 * @param {Object} options
 *   - {String} exec     exec file path
 *   - {Number} count    worker num, defualt to `os.cpus().length`
 *   - {Boolean} refork  refork when disconect and unexpected exit, default to `true`
 * @return {Cluster}
 */

function fork(options) {
  if (cluster.isWorker) {
    return;
  }

  options = options || {};
  var exec = options.exec;
  var count = options.count || os.cpus().length;
  var refork = options.refork !== false;

  if (exec) {
    cluster.setupMaster({
      exec: exec
    });
  }

  var disconnects = {};
  var disconnectCount = 0;
  var unexpectedCount = 0;

  cluster.on('disconnect', function (worker) {
    disconnectCount++;
    disconnects[worker.process.pid] = new Date();
    refork && cluster.fork();
  });

  cluster.on('exit', function (worker, code, signal) {
    if (disconnects[worker.process.pid]) {
      delete disconnects[worker.process.pid];
      // worker disconnect first, exit expected
      return;
    }
    unexpectedCount++;
    refork && cluster.fork();
    cluster.emit('unexpectedExit', worker, code, signal);
  });

  // defer to set the listeners
  // so you can listen this by your own
  defer(function () {
    if (process.listeners('uncaughtException').length === 0) {
      process.on('uncaughtException', onerror);
    }
    if (cluster.listeners('unexpectedExit').length === 0) {
      cluster.on('unexpectedExit', onUnexpected);
    }
  });

  for (var i = 0; i < count; i++) {
    cluster.fork();
  }

  return cluster;

  /**
   * uncaughtException default handler
   */

  function onerror(err) {
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
}
