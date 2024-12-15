/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('node:path');
const util = require('node:util');
const cluster = require('node:cluster');
const http = require('node:http');
const { cfork, setDisableRefork } = require('../../..');

cfork({
  exec: path.join(__dirname, '../worker.cjs'),
  slaves: [
    path.join(__dirname, '../slave.cjs'),
  ],
  args: [ 1984 ],
  limit: 4,
  count: 2,
  duration: 60000,
  autoCoverage: true,
})
  .on('fork', function(worker) {
    console.warn('[%s] [worker:%d] new worker start', Date(), worker.process.pid);
  })
  .on('listening', function(worker, address) {
    console.warn('[%s] [worker:%d] listening on %j', Date(), worker.process.pid, address.port);
    process.send('listening');
  })
  .on('disconnect', function(worker) {
    const propertyName = worker.hasOwnProperty('exitedAfterDisconnect') ? 'exitedAfterDisconnect' : 'suicide';
    console.warn('[%s] [master:%s] worker:%s disconnect, %s: %s, state: %s.',
      Date(), process.pid, worker.process.pid, propertyName, worker[propertyName], worker.state);
  })
  .on('exit', function(worker, code, signal) {
    const exitCode = worker.process.exitCode;
    const propertyName = worker.hasOwnProperty('exitedAfterDisconnect') ? 'exitedAfterDisconnect' : 'suicide';
    const err = new Error(util.format('worker %s died (code: %s, signal: %s, %s: %s, state: %s)',
      worker.process.pid, exitCode, signal, propertyName, worker[propertyName], worker.state));
    err.name = 'WorkerDiedError';
    console.error('[%s] [master:%s] worker exit: %s', Date(), process.pid, err.stack);
  })
  .on('reachReforkLimit', function() {
    process.send('reach refork limit');
  });

process.once('SIGTERM', function() {
  process.exit(0);
});

const port = 1986;

http.createServer(function(req, res) {
  // kill worker
  let count = 0;
  for (const id in cluster.workers) {
    const worker = cluster.workers[id];
    setDisableRefork(worker, true);
    worker.process.kill('SIGTERM');
    count++;
  }
  res.end('kill ' + count + ' workers');
}).listen(port);
