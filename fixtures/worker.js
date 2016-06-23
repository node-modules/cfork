'use strict';

var http = require('http');
var graceful = require('graceful');
var port = Number(process.argv[2] || 1984);

var app = http.createServer(function (req, res) {
  if (req.url === '/error') {
    mock.error();
  }
  if (req.url === '/async_error') {
    setTimeout(function() {
      mock.error();
    }, 1500);
    return;
  }
  if (req.url === '/hold') {
    console.log('[worker:%s] get hold request', process.pid);
    return;
  }
  if (req.url === '/exit') {
    process.exit(0);
  }
  res.end(req.method + ' ' + req.url);
}).listen(port);

graceful({
  server: app,
  killTimeout: 2500,
});

// call cfork on work will be ignore
require('../')();
