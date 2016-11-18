cfork
=======

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Test coverage][cov-image]][cov-url]
[![David deps][david-image]][david-url]

[npm-image]: https://img.shields.io/npm/v/cfork.svg?style=flat
[npm-url]: https://npmjs.org/package/cfork
[travis-image]: https://img.shields.io/travis/node-modules/cfork.svg?style=flat
[travis-url]: https://travis-ci.org/node-modules/cfork
[cov-image]: https://codecov.io/github/node-modules/cfork/coverage.svg?branch=master
[cov-url]: https://codecov.io/github/node-modules/cfork?branch=master
[david-image]: https://img.shields.io/david/node-modules/cfork.svg?style=flat
[david-url]: https://david-dm.org/node-modules/cfork

cluster fork and restart easy way.

* Easy fork with worker file path
* Handle worker restart, even it was exit unexpected.
* Auto error log process `uncaughtException` event

## Install

```bash
$ npm install cfork --save
```

## Usage

### Example

```js
var cfork = require('cfork');
var util = require('util');

cfork({
  exec: '/your/app/worker.js',
  // slaves: ['/your/app/slave.js'],
  // count: require('os').cpus().length,
})
.on('fork', function (worker) {
  console.warn('[%s] [worker:%d] new worker start', Date(), worker.process.pid);
})
.on('disconnect', function (worker) {
  console.warn('[%s] [master:%s] wroker:%s disconnect, suicide: %s, state: %s.',
    Date(), process.pid, worker.process.pid, worker.suicide, worker.state);
})
.on('exit', function (worker, code, signal) {
  var exitCode = worker.process.exitCode;
  var err = new Error(util.format('worker %s died (code: %s, signal: %s, suicide: %s, state: %s)',
    worker.process.pid, exitCode, signal, worker.suicide, worker.state));
  err.name = 'WorkerDiedError';
  console.error('[%s] [master:%s] wroker exit: %s', Date(), process.pid, err.stack);
})

// if you do not listen to this event
// cfork will output this message to stderr
.on('unexpectedExit', function (worker, code, signal) {
  // logger what you want
});

// emit when reach refork times limit
.on('reachReforkLimit', function () {
  // do what you want
});

// if you do not listen to this event
// cfork will listen it and output the error message to stderr
process.on('uncaughtException', function (err) {
  // do what you want
});
```

### Options

- **exec** : exec file path
- **slaves** : slave process config
- **args** : exec arguments
- **count** : fork worker nums, default is `os.cpus().length`
- **refork** : refork when worker disconnect or unexpected exit, default is `true`
- **limit**: limit refork times within the `duration`, default is `60`
- **duration**: default is `60000`, one minute (so, the `refork times` < `limit / duration`)
- **autoCoverage**: auto fork with istanbul when `running_under_istanbul` env set, default is `false`
- **env**: attach some environment variable key-value pairs to the worker / slave process, default to an empty object.

## License

(The MIT License)

Copyright (c) 2014 - 2016 node-modules and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
