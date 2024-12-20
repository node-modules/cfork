# cfork

[![NPM version][npm-image]][npm-url]
[![Node.js CI](https://github.com/node-modules/cfork/actions/workflows/nodejs.yml/badge.svg)](https://github.com/node-modules/cfork/actions/workflows/nodejs.yml)
[![Test coverage][codecov-image]][codecov-url]
[![npm download][download-image]][download-url]
[![Node.js Version](https://img.shields.io/node/v/cfork.svg?style=flat)](https://nodejs.org/en/download/)

[npm-image]: https://img.shields.io/npm/v/cfork.svg?style=flat-square
[npm-url]: https://npmjs.org/package/cfork
[codecov-image]: https://codecov.io/gh/node-modules/cfork/branch/master/graph/badge.svg
[codecov-url]: https://codecov.io/gh/node-modules/cfork
[download-image]: https://img.shields.io/npm/dm/cfork.svg?style=flat-square
[download-url]: https://npmjs.org/package/cfork

cluster fork and restart easy way.

* Easy fork with worker file path
* Handle worker restart, even it was exit unexpected.
* Auto error log process `uncaughtException` event

## Install

```bash
npm install cfork
```

## Usage

### ESM and TypeScript

```ts
import util from 'node:util';
import { cfork } from 'cfork';

const clusterWorker = cfork({
  exec: '/your/app/worker.js',
  // slaves: ['/your/app/slave.js'],
  // count: require('os').cpus().length,
}).on('fork', worker => {
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
  })
  // emit when reach refork times limit
  .on('reachReforkLimit', () => {
    // do what you want
  });

// if you do not listen to this event
// cfork will listen it and output the error message to stderr
process.on('uncaughtException', err => {
  // do what you want
});

// if you want to dynamically disable refork, you can call the setDisableRefork, priority over the refork parameter
cfork.setDisableRefork(clusterWorker, true);
```

### CommonJS

```js
const { cfork } = require('cfork');
```

### Options

* **exec** : exec file path
* **slaves** : slave process config
* **args** : exec arguments
* **count** : fork worker nums, default is `os.cpus().length`
* **refork** : refork when worker disconnect or unexpected exit, default is `true`
* **limit**: limit refork times within the `duration`, default is `60`
* **duration**: default is `60000`, one minute (so, the `refork times` < `limit / duration`)
* **autoCoverage**: auto fork with istanbul when `running_under_istanbul` env set, default is `false`
* **env**: attach some environment variable key-value pairs to the worker / slave process, default to an empty object.
* **windowsHide**: Hide the forked processes console window that would normally be created on Windows systems, default to false.
* **serialization**: Specify the kind of serialization used for sending messages between processes. Possible values are 'json' and 'advanced'. See Advanced serialization for child_process for more details. Default: false.

## License

[MIT](LICENSE)

## Contributors

[![Contributors](https://contrib.rocks/image?repo=node-modules/cfork)](https://github.com/node-modules/cfork/graphs/contributors)

Made with [contributors-img](https://contrib.rocks).
