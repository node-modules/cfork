/**!
 * cfork - test/worker.js
 *
 * Copyright(c) fengmk2 and other contributors.
 * MIT Licensed
 *
 * Authors:
 *   fengmk2 <fengmk2@gmail.com> (http://fengmk2.github.com)
 */

'use strict';

/**
 * Module dependencies.
 */

var http = require('http');
var graceful = require('graceful');

var app = http.createServer(function (req, res) {
  if (req.url === '/error') {
    mock.error();
  }
  res.end(req.method + ' ' + req.url);
}).listen(1984);


graceful({
  server: app,
  killTimeout: 500,
});
