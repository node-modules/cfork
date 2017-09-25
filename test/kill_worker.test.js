'use strict';

var assert = require('assert');
var urllib = require('urllib');
var childprocess = require('childprocess');
var path = require('path');

describe('kill_worker.test.test.js', function() {
  var child;
  var messages = [];

  before(function(done) {
    var workerNum = 2;
    var slaveNum = 1;
    var listeningCount = 0;
    child = childprocess.fork(path.join(__dirname, '..', 'fixtures', 'kill_worker', 'master.js'));
    child.on('message', function (m) {
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

  it('should kill all workers', function(done) {
    urllib.request('http://localhost:1986/', function (err, body) {
      console.log(err, body.toString());
      assert(!err);
      assert(body.toString() === 'kill 3 workers');
      done();
    });
  });
});
