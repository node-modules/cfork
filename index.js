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

module.exports = fork;

function fork(options) {
  if (cluster.isWorker) {
    return;
  }

  options = options || {};
  var exec = options.exec;
  var count = options.count || os.cpus().length;

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
    cluster.fork();
  });

  cluster.on('exit', function (worker, code, signal) {
    if (disconnects[worker.process.pid]) {
      delete disconnects[worker.process.pid];
      // worker disconnect first, exit expected
      return;
    }

    unexpectedCount++;
    var exitCode = worker.process.exitCode;
    var err = new Error(util.format('worker:%s died unexpected (code: %s, signal: %s, suicide: %s, state: %s)',
      worker.process.pid, exitCode, signal, worker.suicide, worker.state));
    err.name = 'WorkerDiedUnexpectedError';
    console.error('[%s] [cfork:master:%s] (total %d disconnect, %d unexpected exit) %s',
      Date(), process.pid, disconnectCount, unexpectedCount, err.stack);
    cluster.fork();
  });

  if (process.listeners('uncaughtException').length === 0) {
    process.on('uncaughtException', function (err) {
      console.error('[%s] [cfork:master:%s] master uncaughtException: %s', Date(), process.pid, err.stack);
      console.error(err);
      console.error('(total %d disconnect, %d unexpected exit)', disconnectCount, unexpectedCount);
    });
  }

  for (var i = 0; i < count; i++) {
    cluster.fork();
  }

  return cluster;
}
