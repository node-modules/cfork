cfork
=======

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Test coverage][codecov-image]][codecov-url]
[![Known Vulnerabilities][snyk-image]][snyk-url]
[![npm download][download-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/cfork.svg?style=flat-square
[npm-url]: https://npmjs.org/package/cfork
[travis-image]: https://img.shields.io/travis/node-modules/cfork.svg?style=flat-square
[travis-url]: https://travis-ci.org/node-modules/cfork
[codecov-image]: https://codecov.io/gh/node-modules/cfork/branch/master/graph/badge.svg
[codecov-url]: https://codecov.io/gh/node-modules/cfork
[snyk-image]: https://snyk.io/test/npm/cfork/badge.svg?style=flat-square
[snyk-url]: https://snyk.io/test/npm/cfork
[download-image]: https://img.shields.io/npm/dm/cfork.svg?style=flat-square
[download-url]: https://npmjs.org/package/cfork

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
const cfork = require('cfork');
const util = require('util');

cfork({
  exec: '/your/app/worker.js',
  // slaves: ['/your/app/slave.js'],
  // count: require('os').cpus().length,
})
.on('fork', worker => {
  console.warn('[%s] [worker:%d] new worker start', Date(), worker.process.pid);
})
.on('disconnect', worker => {
  console.warn('[%s] [master:%s] wroker:%s disconnect, exitedAfterDisconnect: %s, state: %s.',
    Date(), process.pid, worker.process.pid, worker.exitedAfterDisconnect, worker.state);
})
.on('exit', (worker, code, signal) => {
  const exitCode = worker.process.exitCode;
  const err = new Error(util.format('worker %s died (code: %s, signal: %s, exitedAfterDisconnect: %s, state: %s)',
    worker.process.pid, exitCode, signal, worker.exitedAfterDisconnect, worker.state));
  err.name = 'WorkerDiedError';
  console.error('[%s] [master:%s] wroker exit: %s', Date(), process.pid, err.stack);
})

// if you do not listen to this event
// cfork will output this message to stderr
.on('unexpectedExit', (worker, code, signal) => {
  // logger what you want
});

// emit when reach refork times limit
.on('reachReforkLimit', () => {
  // do what you want
});

// if you do not listen to this event
// cfork will listen it and output the error message to stderr
process.on('uncaughtException', err => {
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
- **windowsHide**: Hide the forked processes console window that would normally be created on Windows systems, default to false.
- **serialization**: Specify the kind of serialization used for sending messages between processes. Possible values are 'json' and 'advanced'. See Advanced serialization for child_process for more details. Default: false.

## License

```
(The MIT License)

Copyright (c) 2014 - 2017 node-modules and other contributors

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
```

<!-- GITCONTRIBUTOR_START -->

## Contributors

|[<img src="https://avatars.githubusercontent.com/u/156269?v=4" width="100px;"/><br/><sub><b>fengmk2</b></sub>](https://github.com/fengmk2)<br/>|[<img src="https://avatars.githubusercontent.com/u/14790466?v=4" width="100px;"/><br/><sub><b>greenkeeperio-bot</b></sub>](https://github.com/greenkeeperio-bot)<br/>|[<img src="https://avatars.githubusercontent.com/u/985607?v=4" width="100px;"/><br/><sub><b>dead-horse</b></sub>](https://github.com/dead-horse)<br/>|[<img src="https://avatars.githubusercontent.com/u/327019?v=4" width="100px;"/><br/><sub><b>JacksonTian</b></sub>](https://github.com/JacksonTian)<br/>|[<img src="https://avatars.githubusercontent.com/u/1474688?v=4" width="100px;"/><br/><sub><b>luckydrq</b></sub>](https://github.com/luckydrq)<br/>|[<img src="https://avatars.githubusercontent.com/u/2842176?v=4" width="100px;"/><br/><sub><b>XadillaX</b></sub>](https://github.com/XadillaX)<br/>|
| :---: | :---: | :---: | :---: | :---: | :---: |
|[<img src="https://avatars.githubusercontent.com/u/360661?v=4" width="100px;"/><br/><sub><b>popomore</b></sub>](https://github.com/popomore)<br/>|[<img src="https://avatars.githubusercontent.com/u/18315?v=4" width="100px;"/><br/><sub><b>hemanth</b></sub>](https://github.com/hemanth)<br/>|[<img src="https://avatars.githubusercontent.com/u/3230673?v=4" width="100px;"/><br/><sub><b>qingdengyue</b></sub>](https://github.com/qingdengyue)<br/>|[<img src="https://avatars.githubusercontent.com/u/1422472?v=4" width="100px;"/><br/><sub><b>jpuncle</b></sub>](https://github.com/jpuncle)<br/>|[<img src="https://avatars.githubusercontent.com/u/1102038?v=4" width="100px;"/><br/><sub><b>hustxiaoc</b></sub>](https://github.com/hustxiaoc)<br/>|[<img src="https://avatars.githubusercontent.com/u/2972143?v=4" width="100px;"/><br/><sub><b>nightink</b></sub>](https://github.com/nightink)<br/>|
[<img src="https://avatars.githubusercontent.com/u/7971415?v=4" width="100px;"/><br/><sub><b>paranoidjk</b></sub>](https://github.com/paranoidjk)<br/>|[<img src="https://avatars.githubusercontent.com/u/19849579?v=4" width="100px;"/><br/><sub><b>sinkhaha</b></sub>](https://github.com/sinkhaha)<br/>

This project follows the git-contributor [spec](https://github.com/xudafeng/git-contributor), auto updated at `Sat May 06 2023 00:30:47 GMT+0800`.

<!-- GITCONTRIBUTOR_END -->
