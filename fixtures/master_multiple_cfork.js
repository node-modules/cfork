'use strict';

var path = require('path');
var util = require('util');
var cluster = require('cluster');
var cfork = require('../');
var worker = path.join(__dirname, 'worker.js');
var slave = path.join(__dirname, 'slave.js');

cluster.on('fork', function (worker) {
  console.warn('[%s] [worker:%d] new worker start', Date(), worker.process.pid);
})
.on('listening', function (worker, address) {
  if (address.port === 1990) {
    process.once('message', function(message) {
      if(message === 'kill_slave') {
        worker._refork = false;
        worker.send('kill_slave');
      }
    });
  }
  worker.port = address.port;
  console.warn('[%s] [worker:%d] listening on %j', Date(), worker.process.pid, address.port);
  process.send('listening');
})
.on('disconnect', function (worker) {
  console.warn('[%s] [master:%s] worker:%s disconnect, suicide: %s, state: %s.',
    Date(), process.pid, worker.process.pid, worker.suicide, worker.state);
})
.on('exit', function (worker, code, signal) {
  var exitCode = worker.process.exitCode;
  var err = new Error(util.format('worker %s died (code: %s, signal: %s, suicide: %s, state: %s)',
    worker.process.pid, exitCode, signal, worker.suicide, worker.state));
  err.name = 'WorkerDiedError';
  console.error('[%s] [master:%s] worker exit: %s', Date(), process.pid, err.stack);

  if (worker.port === 1990) {
    process.send('slave_die');
  }
})
.on('reachReforkLimit', function () {
  process.send('reach refork limit');
});

cfork({
  exec: worker,
  args: [ 1988 ],
  count: 1,
  autoCoverage: true,
  env: {
    CFORK_ENV_TEST: '😂',
  },
});

cfork({
  exec: slave,
  args: [ 1989 ],
  count: 1,
  autoCoverage: true,
  env: {
    CFORK_ENV_TEST: '😂',
  },
});

cfork({
  exec: slave,
  args: [ 1990 ],
  count: 1,
  autoCoverage: true,
  env: {
    CFORK_ENV_TEST: '😂',
  },
});

process.once('SIGTERM', function () {
  process.exit(0);
});

process.once('SIGTERM', function () {
  process.exit(0);
});


console.log('master:%s start', process.pid);
