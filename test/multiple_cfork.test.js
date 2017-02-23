'use strict';

var should = require('should');
var urllib = require('urllib');
var childprocess = require('childprocess');
var path = require('path');

describe.only('multiple_cfork.test.js', function () {
  var child;
  var messages = [];

  before(function (done) {
    var workerNum = 1;
    var slaveNum = 2;
    var listeningCount = 0;
    child = childprocess.fork(path.join(__dirname, '..', 'fixtures', 'master_multiple_cfork.js'));
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

  after(function (done) {
    setTimeout(function () {
      child.kill('SIGTERM');
      setTimeout(done, 1000);
    }, 1000);
  });

  it('should worker listen worked', function (done) {
    urllib.request('http://localhost:1988/', function (err, body, res) {
      should.not.exist(err);
      body.toString().should.equal('GET /');
      res.statusCode.should.equal(200);
      done();
    });
  });

  it('should slave listen worked', function (done) {
    urllib.request('http://localhost:1989/', function (err, body, res) {
      should.not.exist(err);
      body.toString().should.equal('GET /');
      res.statusCode.should.equal(200);
      urllib.request('http://localhost:1990/', function (err, body, res) {
        should.not.exist(err);
        body.toString().should.equal('GET /');
        res.statusCode.should.equal(200);
        done();
      });
    });
  });

  it('should get correct env value', function (done) {
    urllib.request('http://localhost:1988/env', function (err, body, resp) {
      should.ifError(err);
      body.toString().should.equal('😂');
      resp.statusCode.should.equal(200);
      urllib.request('http://localhost:1989/env', function (err, body, resp) {
        should.ifError(err);
        body.toString().should.equal('😂');
        resp.statusCode.should.equal(200);
        done();
      });
    });
  });

  it('should slave error and refork', function (done) {
    child.once('message', function(message) {
      if (message === 'listening') {
        urllib.request('http://localhost:1989/', function (err, body, res) {
          should.not.exist(err);
          body.toString().should.equal('GET /');
          res.statusCode.should.equal(200);
          urllib.request('http://localhost:1989/env', function (err, body, resp) {
            should.ifError(err);
            body.toString().should.equal('😂');
            resp.statusCode.should.equal(200);
            done();
          });
        });
      }
    });
    urllib.request('http://localhost:1989/error', function (err) {
      should.exist(err);
    });
  });

  it('should worker error and refork', function (done) {
    child.once('message', function(message) {
      if (message === 'listening') {
        urllib.request('http://localhost:1988/', function (err, body, res) {
          should.not.exist(err);
          body.toString().should.equal('GET /');
          res.statusCode.should.equal(200);
          urllib.request('http://localhost:1988/env', function (err, body, resp) {
            should.ifError(err);
            body.toString().should.equal('😂');
            resp.statusCode.should.equal(200);
            done();
          });
        });
      }
    });
    urllib.request('http://localhost:1988/error', function (err) {
      should.exist(err);
    });
  });

  it('should not refork slave', function(done) {
    child.send('kill_slave');
    child.once('message', function(message) {
      if (message === 'slave_die') {
        setTimeout(function(){
          urllib.request('http://localhost:1990/error', function (err) {
            should.exist(err);
            done();
          });
        }, 1000);
      }
    });
  });

});
