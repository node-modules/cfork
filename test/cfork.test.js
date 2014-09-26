/**!
 * cluster-restart - test/cfork.test.js
 *
 * Copyright(c) 2014 fengmk2 and other contributors.
 * MIT Licensed
 *
 * Authors:
 *   fengmk2 <fengmk2@gmail.com> (http://fengmk2.github.com)
 */

"use strict";

/**
 * Module dependencies.
 */

var should = require('should');
var pedding = require('pedding');
var urllib = require('urllib');
var childProcess = require('child_process');
var path = require('path');

describe('cfork.test.js', function () {
  var child;
  var messages = [];

  before(function (done) {
    child = childProcess.fork(path.join(__dirname, 'master.js'));
    child.on('message', function (m) {
      messages.push(m);
    });
    setTimeout(done, 1000);
  });

  after(function (done) {
    setTimeout(function () {
      child.kill();
      setTimeout(done, 1000);
    }, 1000);
  });

  it('should worker listen worked', function (done) {
    urllib.request('http://localhost:1984/', function (err, body, res) {
      should.not.exist(err);
      body.toString().should.equal('GET /');
      res.statusCode.should.equal(200);
      done();
    });
  });

  it('should mock worker error', function (done) {
    urllib.request('http://localhost:1984/error', function (err, body, res) {
      should.exist(err);
      done();
    });
  });

  it('should make all workers down', function (done) {
    done = pedding(4, done);
    urllib.request('http://localhost:1984/error', function (err, body, res) {
      should.exist(err);
      done();
    });
    urllib.request('http://localhost:1984/error', function (err, body, res) {
      should.exist(err);
      done();
    });
    urllib.request('http://localhost:1984/error', function (err, body, res) {
      should.exist(err);
      done();
    });
    urllib.request('http://localhost:1984/error', function (err, body, res) {
      should.exist(err);
      done();
    });
  });

  it('should get message `reach refork limit`', function (done) {
    urllib.request('http://localhost:1984/error', function (err, body, res) {
      should.exist(err);
      messages.indexOf('reach refork limit').should.above(-1);
      done();
    });
  });
});
