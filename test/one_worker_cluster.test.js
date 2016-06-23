'use strict';

var should = require('should');
var pedding = require('pedding');
var urllib = require('urllib');
var childprocess = require('childprocess');
var path = require('path');

describe('one_worker_cluster.test.js', function() {
  var child;
  var messages = [];

  before(function(done) {
    var workerNum = 1;
    var slaveNum = 1;
    var listeningCount = 0;
    child = childprocess.fork(path.join(__dirname, '..', 'fixtures', 'one_worker_cluster', 'master.js'));
    child.on('message', function (m) {
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

  it('should mock worker async_error', function(done) {
    done = pedding(2, done);
    urllib.request('http://localhost:1984/async_error', function(err) {
      console.error('[cfork.test.js] get /async_error error: %s', err);
      should.exist(err);
      err.message.should.containEql('socket hang up');
      done();
    });

    // request handle by same worker
    urllib.request('http://localhost:1984/hold', {
      timeout: 10000,
    }, function (err) {
      console.error('[cfork.test.js] get /hold error: %s', err);
      should.exist(err);
      err.message.should.containEql('socket hang up');
      done();
    });
  });
});
