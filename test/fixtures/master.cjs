/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('node:path');
const util = require('node:util');
const { cfork } = require('../..');

cfork({
  exec: path.join(__dirname, 'worker.cjs'),
  slaves: [
    path.join(__dirname, 'slave.cjs'),
  ],
  args: [ 1984 ],
  limit: 10,
  count: 4,
  duration: 60000,
  autoCoverage: true,
  env: {
    CFORK_ENV_TEST: '😂',
    NODE_ENV: 'dev',
  },
})
  .on('fork', function(worker) {
    console.warn('[%s] [test:worker:%d] new worker start', Date(), worker.process.pid);
  })
  .on('listening', function(worker, address) {
    console.warn('[%s] [test:worker:%d] listening on %j', Date(), worker.process.pid, address.port);
    process.send('listening');
  })
  .on('disconnect', function(worker) {
    const propertyName = worker.hasOwnProperty('exitedAfterDisconnect') ? 'exitedAfterDisconnect' : 'suicide';
    console.warn('[%s] [test:master:%s] worker:%s disconnect, %s: %s, state: %s.',
      Date(), process.pid, worker.process.pid, propertyName, worker[propertyName], worker.state);
  })
  .on('exit', function(worker, code, signal) {
    const exitCode = worker.process.exitCode;
    const propertyName = worker.hasOwnProperty('exitedAfterDisconnect') ? 'exitedAfterDisconnect' : 'suicide';
    const err = new Error(util.format('worker %s died (code: %s, signal: %s, %s: %s, state: %s)',
      worker.process.pid, exitCode, signal, propertyName, worker[propertyName], worker.state));
    err.name = 'WorkerDiedError';
    console.error('[%s] [test:master:%s] worker exit: %s', Date(), process.pid, err.stack);
  })
  .on('reachReforkLimit', function() {
    process.send('reach refork limit');
  });

process.once('SIGTERM', function() {
  process.exit(0);
});

setTimeout(function() {
  master.mock.uncaughtException;
}, 500);
console.log('test:master:%s start', process.pid);
