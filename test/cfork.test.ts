import assert from 'node:assert';
import { setTimeout as sleep } from 'node:timers/promises';
import childprocess, { type ChildProcess, type Serializable } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import urllib from 'urllib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('test/cfork.test.ts', () => {
  let child: ChildProcess;
  const messages: Serializable[] = [];

  before(function(done) {
    const workerNum = 4;
    const slaveNum = 1;
    let listeningCount = 0;
    child = childprocess.fork(path.join(__dirname, 'fixtures', 'master.cjs'));
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

  it('should worker listen worked', async () => {
    const response = await urllib.request('http://127.0.0.1:1984/', {
      dataType: 'text',
    });
    assert.equal(response.data, 'GET /');
    assert.equal(response.status, 200);
  });

  it('should mock worker error', async () => {
    await assert.rejects(async () => {
      await urllib.request('http://127.0.0.1:1984/error', {
        dataType: 'text',
      });
    }, /(timeout|other side closed)/);
  });

  it('should worker exit', async () => {
    await assert.rejects(async () => {
      await urllib.request('http://127.0.0.1:1984/exit', {
        dataType: 'text',
      });
    }, /other side closed/);
  });

  it('should slave listen worked', async () => {
    const response = await urllib.request('http://127.0.0.1:1985/', {
      dataType: 'text',
    });
    assert.equal(response.data, 'GET /');
    assert.equal(response.status, 200);
  });

  it('should get correct env value', async () => {
    let response = await urllib.request('http://127.0.0.1:1984/env', {
      dataType: 'text',
    });
    assert.equal(response.data, '😂');
    assert.equal(response.status, 200);
    response = await urllib.request('http://127.0.0.1:1985/env', {
      dataType: 'text',
    });
    assert.equal(response.data, '😂');
    assert.equal(response.status, 200);
  });

  it('should get CFORK_WORKER_INDEX env value', async () => {
    let response = await urllib.request('http://127.0.0.1:1984/worker_index', {
      dataType: 'text',
    });
    const text = response.data;
    assert(text === 'worker index: 0, 4' || text === 'worker index: 1, 4'
      || text === 'worker index: 2, 4' || text === 'worker index: 3, 4', text);
    assert.equal(response.status, 200);

    response = await urllib.request('http://127.0.0.1:1985/worker_index', {
      dataType: 'text',
    });
    assert(text === 'worker index: 0, 4' || text === 'worker index: 1, 4'
      || text === 'worker index: 2, 4' || text === 'worker index: 3, 4', text);
    assert.equal(response.status, 200);
    assert.equal(response.data, 'slave worker index: 0, 1');
  });

  it('should mock worker async_error', async () => {
    await assert.rejects(async () => {
      await urllib.request('http://127.0.0.1:1984/async_error', {
        dataType: 'text',
      });
    }, (err: any) => {
      console.error('[cfork.test.ts] get /async_error error: %s', err);
      // ECONNRESET on windows
      if (process.platform === 'win32') {
        assert.match(err.message, /ECONNRESET/);
      } else {
        assert.match(err.message, /(socket hang up|other side closed|timeout)/);
      }
      return true;
    });

    await assert.rejects(async () => {
      await urllib.request('http://127.0.0.1:1984/hold', {
        dataType: 'text',
      });
    }, (err: any) => {
      console.error('[cfork.test.ts] get /hold error: %s', err);
      // ECONNRESET on windows
      if (process.platform === 'win32') {
        assert.match(err.message, /ECONNRESET/);
      } else {
        assert.match(err.message, /timeout/);
      }
      return true;
    });
  });

  it('should slave exit', async () => {
    await assert.rejects(async () => {
      await urllib.request('http://127.0.0.1:1985/exit', {
        dataType: 'text',
      });
    }, /ECONNREFUSED/);
    // wait for slave listening
    await sleep(1000);
  });

  it('should slave error and refork', async () => {
    console.log('start request slave/error');
    await assert.rejects(async () => {
      await urllib.request('http://127.0.0.1:1985/error', {
        dataType: 'text',
      });
    }, (err: any) => {
      // console.error(err);
      assert.match(err.message, /(other side closed|ECONNREFUSED)/);
      return true;
    });

    let success = false;
    while (!success) {
      try {
        let response = await urllib.request('http://127.0.0.1:1985/', {
          dataType: 'text',
        });
        assert.equal(response.data, 'GET /');
        assert.equal(response.status, 200);

        response = await urllib.request('http://127.0.0.1:1985/env', {
          dataType: 'text',
        });
        assert.equal(response.data, '😂');
        assert.equal(response.status, 200);

        response = await urllib.request('http://127.0.0.1:1985/worker_index', {
          dataType: 'text',
        });
        assert.equal(response.data, 'slave worker index: 0, 1');
        assert.equal(response.status, 200);
        success = true;
      } catch (err) {
        // console.error(err);
      }
    }
    await sleep(5000);
  });

  it('should make all workers down', async () => {
    await assert.rejects(async () => {
      await urllib.request('http://127.0.0.1:1984/error', {
        dataType: 'text',
        timeout: 5000,
      });
    }, (err: any) => {
      assert.match(err.message, /(timeout|ECONNREFUSED|other side closed)/);
      return true;
    });
    await assert.rejects(async () => {
      await urllib.request('http://127.0.0.1:1984/error', {
        dataType: 'text',
        timeout: 5000,
      });
    }, (err: any) => {
      assert.match(err.message, /(timeout|ECONNREFUSED|other side closed)/);
      return true;
    });
    await assert.rejects(async () => {
      await urllib.request('http://127.0.0.1:1984/error', {
        dataType: 'text',
        timeout: 5000,
      });
    }, (err: any) => {
      assert.match(err.message, /(timeout|ECONNREFUSED|other side closed)/);
      return true;
    });
    await assert.rejects(async () => {
      await urllib.request('http://127.0.0.1:1984/error', {
        dataType: 'text',
        timeout: 5000,
      });
    }, (err: any) => {
      assert.match(err.message, /(timeout|ECONNREFUSED|other side closed)/);
      return true;
    });
    await assert.rejects(async () => {
      await urllib.request('http://127.0.0.1:1984/error', {
        dataType: 'text',
        timeout: 5000,
      });
    }, (err: any) => {
      assert.match(err.message, /(timeout|ECONNREFUSED|other side closed)/);
      return true;
    });
    await assert.rejects(async () => {
      await urllib.request('http://127.0.0.1:1984/error', {
        dataType: 'text',
        timeout: 5000,
      });
    }, (err: any) => {
      assert.match(err.message, /(timeout|ECONNREFUSED|other side closed)/);
      return true;
    });
  });

  it('should get message `reach refork limit`, no new fork worker', async () => {
    await assert.rejects(async () => {
      await urllib.request('http://127.0.0.1:1984/error', {
        dataType: 'text',
        timeout: 5000,
      });
    }, (err: any) => {
      assert.match(err.message, /ECONNREFUSED/);
      return true;
    });
  });
});
