/**!
 * Copyright(c) node-modules and other contributors.
 * MIT Licensed
 *
 * Authors:
 *   fengmk2 <fengmk2@gmail.com> (http://fengmk2.com)
 */

'use strict';

/**
 * Module dependencies.
 */

var http = require('http');
var graceful = require('graceful');
var port = Number(process.argv[2] || 1984);

var app = http.createServer(function (req, res) {
  if (req.url === '/error') {
    mock.error();
  }
  if (req.url === '/exit') {
    process.exit(0);
  }
  res.end(req.method + ' ' + req.url);
}).listen(port);

graceful({
  server: app,
  killTimeout: 500,
});

// call cfork on work will be ignore
require('../')();
