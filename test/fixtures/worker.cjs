/* eslint-disable @typescript-eslint/no-var-requires */
const http = require('node:http');
const { graceful } = require('graceful');

const port = Number(process.argv[2] || 1984);

const app = http.createServer((req, res) => {
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
  if (req.url === '/env') {
    return res.end(process.env.CFORK_ENV_TEST);
  }
  if (req.url === '/worker_index') {
    return res.end(`worker index: ${process.env.CFORK_WORKER_INDEX}, ${process.env.CFORK_WORKER_COUNT}`);
  }
  res.end(req.method + ' ' + req.url);
}).listen(port);

graceful({
  server: app,
  killTimeout: 2500,
});

// call cfork on work will be ignore
require('../..').cfork();
