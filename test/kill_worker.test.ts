import assert from 'node:assert';
import childprocess, { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import urllib from 'urllib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('test/kill_worker.test.ts', () => {
  let child: ChildProcess;
  const messages = [];

  before(function(done) {
    const workerNum = 2;
    const slaveNum = 1;
    let listeningCount = 0;
    child = childprocess.fork(path.join(__dirname, 'fixtures', 'kill_worker', 'master.cjs'));
    child.on('message', function(m) {
      messages.push(m);
      console.log(m, listeningCount);
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

  it('should kill all workers', async () => {
    const response = await urllib.request('http://localhost:1986/', {
      dataType: 'text',
    });
    assert.equal(response.data, 'kill 3 workers');
  });
});
