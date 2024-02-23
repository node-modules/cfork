'use strict';

var http = require('http');
var graceful = require('graceful');
var port = 1985;

var app = http.createServer(function (req, res) {
  if (req.url === '/error') {
    mock.error();
  }
  if (req.url === '/exit') {
    process.exit(0);
  }
  if (req.url === '/env') {
    return res.end(process.env.CFORK_ENV_TEST);
  }
  if (req.url === '/worker_index') {
    return res.end(`worker index: ${process.env.CFORK_WORKER_INDEX}`);
  }
  res.end(req.method + ' ' + req.url);
}).listen(port);

graceful({
  server: app,
  killTimeout: 500,
});

// call cfork on work will be ignore
require('../')();
