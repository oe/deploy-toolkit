<h1 align="center">Deploy toolkit</h1>

<h5>A toolkit make it easy(with plain config) to manipulate(upload/download/exec command) server via `ssh`,  can be used to deploy stuffs or CI/CD. </h5>

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

All actions are run in sequence, and you can set allow failure for specific action(wont stop the sequence even it failed).

## Exmaple

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
    //   use ~ as user homedir
    privateKey: '~/.ssh/my-private-key'
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
      args: ['pm2', 'stop', 'my-fancy-app'],
      // if pm2 stop failed, still continue to run the following cmds
      allowFailure: true
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

// run commands
deploy(config).then(() => {
  console.log('all done!')
}).catch((err) => {
  console.warn(err)
})
```

## Usage

### Install

```sh
yarn add deploy-toolkit
```

### API

```typescript
/** upload config */
interface IUploadConfig {
    type: 'upload'
    /** source file(in local), could be a specified file path, directory path or a glob pattern */
    src: string
    /** if src is a glob pattern, then srcPrefix is need, to determine the path save on server */
    srcPrefix?: string
    /** destination path(on server), should be a file path if src is a specified file, or a directory for other situations */
    dest: string
    /** allow failure, so the command sequence will continue to run even this failed */
    allowFailure?: boolean
}

/** download config */
interface IDownloadConfig {
    type: 'download'
    /** source file path(on server) */
    src: string
    /** dest save path(in local) */
    dest: string
    /** allow failure, so the command sequence will continue to run even this failed */
    allowFailure?: boolean
}

/** custom command */
interface IRunConfig {
    type: 'cmd'
    /** cmd arguments */
    args: string[]
    /** cmd work directory */
    cwd?: string
    /** options */
    options?: {
        /** another way to set work directory, will be rewrite if set outside */
        cwd?: string
        /** extra options for ssh2.exec */
        options?: Object
        /** input for the command */
        stdin?: string
        /** output */
        stream?: 'stdout' | 'stderr' | 'both'
        /** stdout event */
        onStdout?: ((chunk: Buffer) => void)
        /** stderror event */
        onStderr?: ((chunk: Buffer) => void)
    }
    /** allow failure, so the command sequence will continue to run even this failed */
    allowFailure?: boolean
}
/** command */
type ICmd = IUploadConfig | IDownloadConfig | IRunConfig

/** commands sequence */
type ICmds = ICmd[]

/** SSH Connection config */
interface ISshConfig {
    /** Hostname or IP address of the server. */
    host: string
    /** Port number of the server. */
    port?: number
    /** Username for authentication. */
    username?: string
    /** Password for password-based user authentication. */
    password?: string
    /** file path of the private key, or the private key text content */
    privateKey?: string
    /** For an encrypted private key, this is the passphrase used to decrypt it. */
    passphrase?: string
    /** any other options from ssh2 ConnectConfig */
    [k: string]: any
}

/** deploy confgi */
interface IDeployConfig {
    /** ssh connection config */
    ssh: ISshConfig
    /** whether to show log when executing cmds */
    log?: boolean
    /** command sequence */
    cmds: ICmds
}

function deploy(deployCmd: IDeployConfig): Promise<void>

// import the main function like this
import { deploy } from 'deploy-toolkit'
// you can import these types if you are using typescript
import { IDeployConfig } from 'deploy-toolkit'
```
