/**!
 * Copyright(c) node-modules and other contributors.
 * MIT Licensed
 *
 * Authors:
 *   fengmk2 <fengmk2@gmail.com> (http://fengmk2.com)
 */

'use strict';

/**
 * Module dependencies.
 */

var path = require('path');
var util = require('util');
var cfork = require('../');

cfork({
  exec: path.join(__dirname, 'worker.js'),
  args: [ 1984 ],
  limit: 4,
  count: 4,
  duration: 60000
})
.on('fork', function (worker) {
  console.warn('[%s] [worker:%d] new worker start', Date(), worker.process.pid);
})
.on('listening', function (worker, address) {
  console.warn('[%s] [worker:%d] listening on %j', Date(), worker.process.pid, address.port);
  process.send('listening');
})
.on('disconnect', function (worker) {
  console.warn('[%s] [master:%s] wroker:%s disconnect, suicide: %s, state: %s.',
    Date(), process.pid, worker.process.pid, worker.suicide, worker.state);
})
.on('exit', function (worker, code, signal) {
  var exitCode = worker.process.exitCode;
  var err = new Error(util.format('worker %s died (code: %s, signal: %s, suicide: %s, state: %s)',
    worker.process.pid, exitCode, signal, worker.suicide, worker.state));
  err.name = 'WorkerDiedError';
  console.error('[%s] [master:%s] wroker exit: %s', Date(), process.pid, err.stack);
})
.on('reachReforkLimit', function () {
  process.send('reach refork limit');
});

process.once('SIGTERM', function () {
  process.exit(0);
});

setTimeout(function () {
  mock.uncaughtException;
}, 500);
