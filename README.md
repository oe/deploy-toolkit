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
import { deploy, runShellCmd,  findFileRecursive, addGitTag} from 'deploy-toolkit'
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
    // set passphrase if private key is encrypted
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
      // command work directory on remote server
      cwd: '/home/user'
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
      cwd: '/home/user'
    },
    {
      // upload files
      type: 'upload',
      // files' glob pattern, could also be a file/dir path
      src: path.join(__dirname, '../*/*.json'),
      // if upload multi files with glob pattern, srcPrefix is needed to determine to saved path on server
      //  no need if `src` is certain a file/dir path
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

// run local shell commands
runShellCmd('ls', ['-l']).then((res) => {
  console.log('ls response', res)
})

// find closest package.json file full path, return '' if not found
console.log(findFileRecursive('package.json'))
// found closest .git dir full path from current work dir, return '' if not found
console.log(findFileRecursive('.git', process.cwd(), true))

// add git tag & puth to remote, use `v${package.version}` in package.json as tag name by default
addGitTag().then((tagName) => {
  console.log('done, has added tag', tagName)
})

// sepecify the tag name
addGitTag('v10.0.0-beta').then(() => {
  console.log('done')
})

```

## Usage

### Install

```sh
yarn add deploy-toolkit
```

### API

#### deploy

Deploy stuffs to remote server with simple json config, you can upload/download/execute-command on remote server.

```typescript
// import the main function like this
import { deploy } from 'deploy-toolkit'
// // you can import the following types if you are using typescript
// import { IDeployConfig } from 'deploy-toolkit'

function deploy(deployCmd: IDeployConfig): Promise<void>

/** deploy confgi */
interface IDeployConfig {
    /** ssh connection config */
    ssh: ISshConfig
    /** whether to show log when executing cmds */
    log?: boolean
    /** command sequence */
    cmds: ICmds
}

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
/** commands sequence */
type ICmds = ICmd[]

/** command */
type ICmd = IUploadConfig | IDownloadConfig | IRunConfig

/** upload config */
interface IUploadConfig {
    type: 'upload'
    /** source file(in local), could be a specified file/directory path or a glob pattern */
    src: string
    /** if src is a glob pattern, then srcPrefix is need, to determine the path save on server. omit it if src is a spicifed file/directory path */
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
```

#### runShellCmd

run shell command on local machine, a promise wrapper of node `child_process.spawn`, by default run the command in cwd `process.cwd()`

```typescript
import { runShellCmd } from 'deploy-toolkit'
// return promise with execution result
function runShellCmd(cmd: string, options?: SpawnOptions): Promise<string>
function runShellCmd(
    cmd: string,
    args?: string[],
    options?: SpawnOptions
): Promise<string>

// check nodejs doc http://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options for detail explains
interface SpawnOptions {
    cwd?: string // default is process.cwd()
    env?: any
    stdio?: any
    detached?: boolean
    uid?: number
    gid?: number
    shell?: boolean | string
    windowsVerbatimArguments?: boolean
    windowsHide?: boolean
}
```

#### findFileRecursive

find a file/dir recursively from specified dir to the root until found, return `''` if not found.

```typescript
/**
 * find a file(dir) recursive( aka try to find package.json, node_modules, etc.)
 * @param fileName file name(or dir name if isDir is true)
 * @param dir the initial dir path to find, use `process.cwd()` by default
 * @param isDir whether to find a dir
 */
export declare function findFileRecursive(
    fileName: string,
    dir?: string,
    isDir?: boolean
): string
```

#### addGitTag

add git tag and push it to remote, you can use it on `postbuild` or `postpublish`.  
use `v${package.version}` in package.json as tag name by default, return the `tagName` after tag push

```typescript
function addGitTag(tagName?: string): Promise<string>
```
