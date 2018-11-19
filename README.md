<h1 align="center">Deploy toolkit</h1>

<div align="center">
  <a href="https://travis-ci.org/evecalm/deploy-toolkit">
    <img src="https://travis-ci.org/evecalm/deploy-toolkit.svg?branch=master" alt="Travis CI">
  </a>
  <a href="#readme">
    <img src="https://badges.frapsoft.com/typescript/code/typescript.svg?v=101" alt="code with typescript" height="20">
  </a>
  <a href="#readme">
    <img src="https://badge.fury.io/js/deploy-toolkit.svg" alt="npm version" height="18">
  </a>
  <a href="https://www.npmjs.com/package/deploy-toolkit">
    <img src="https://img.shields.io/npm/dm/deploy-toolkit.svg" alt="npm version" height="18">
  </a>
</div>

## Usage

### Install

```sh
yarn add deploy-toolkit
```

### Exmaple

```js
import { deploy } from 'deploy-toolkit'
import fs from 'fs'
import path from 'path'

const config = {
  // ssh connection config
  ssh: {
    host: 'my.server.com',
    username: 'fancy',
    // // use password if you prefer password
    // password: '123456'
    // or private ssh key file path(or key text content)
    privateKey: '/Users/xxx/.ssh/my-private-key'
    // set passphrase if private key has passphrase
    passphrase: '3344',
  },
  // whether to show command execution logs
  log: true,
  // commands sequence, will execute by its order
  cmds: [
    {
      // exec command
      type: 'cmd',
      // command arguments list
      args: ['mkdir', '-p', 'saiya/test'],
      // command work directory
      cwd: '~'
    },
    {
      type: 'cmd',
      args: ['ls', 'saiya', '-l'],
      cwd: '~'
    },
    {
      // upload files
      type: 'upload',
      // files' glob pattern
      src: path.join(__dirname, '../*/*.json'),
      // if upload multi files with glob pattern, srcPrefix is needed to determine to saved path on server
      srcPrefix: path.join(__dirname, '..'),
      // server directory path to save the files
      dest: '/home/kk/saiya'
    },
    {
      // download file, only support download a single file at a time
      type: 'download',
      // source file path on server
      src: '/home/kk/start.sh',
      // saved path in local
      dest: path.join(__dirname, 'gg.sh')
    }
  ]
}

deploy(config).then(() => {
  console.log('all done!')
}).catch((err) => {
  console.warn(err)
})
```
