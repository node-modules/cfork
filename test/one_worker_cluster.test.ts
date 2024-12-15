import { strict as assert } from 'node:assert';
import childprocess, { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import urllib from 'urllib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('test/one_worker_cluster.test.ts', () => {
  let child: ChildProcess;
  const messages = [];

  before(function(done) {
    const workerNum = 1;
    const slaveNum = 1;
    let listeningCount = 0;
    child = childprocess.fork(path.join(__dirname, 'fixtures', 'one_worker_cluster', 'master.cjs'));
    child.on('message', function(m) {
      messages.push(m);
      if (m === 'listening') {
        ++listeningCount;
        if (listeningCount === (workerNum + slaveNum)) {
          done();
        }
      }
    });
  });

  after(function(done) {
    setTimeout(function() {
      child.kill('SIGTERM');
      setTimeout(done, 1000);
    }, 1000);
  });

  it('should mock worker async_error', async () => {
    await urllib.request('http://localhost:1984/');
    await urllib.request('http://localhost:1985/');

    await assert.rejects(async () => {
      await urllib.request('http://localhost:1984/async_error');
    }, (err: any) => {
      assert.match(err.message, /(ECONNRESET|socket hang up|timeout|ECONNRESET)/);
      return true;
    });

    // request handle by same worker
    await assert.rejects(async () => {
      await urllib.request('http://localhost:1984/hold');
    }, (err: any) => {
      assert.match(err.message, /(ECONNRESET|socket hang up|timeout|ECONNRESET)/);
      return true;
    });

    await urllib.request('http://localhost:1984/');
    await urllib.request('http://localhost:1985/');
  });
});
