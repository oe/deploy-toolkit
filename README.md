# Deploy toolkit

A small TypeScript toolkit for sequential SSH commands, uploads, downloads, and shell scripts. Useful for deploying build output to a few servers from a Node.js script or CI job.

[![CI](https://github.com/oe/deploy-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/oe/deploy-toolkit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/deploy-toolkit.svg)](https://www.npmjs.com/package/deploy-toolkit)

## Requirements and status

Version 0.2.0 requires **Node.js 20 or 22 and later**, an SSH server supporting command execution/SFTP, and a POSIX remote shell. Script actions require Bash by default, or another POSIX-compatible shell selected with `shell`/`shebang`.

This project is suited to maintenance of its small existing API. For deployment inventories, rolling releases, rollback orchestration, or configuration management, use a dedicated tool such as Ansible. See [the maintenance assessment](MAINTENANCE.md) and [migration notes](CHANGELOG.md).

## Install

```sh
pnpm add -D deploy-toolkit
```

To develop from a checkout, use Node.js 22.12 or later and run `pnpm install --frozen-lockfile && pnpm build`.

## Deploy

```js
const { deploy } = require('deploy-toolkit')
const path = require('node:path')

async function main() {
  await deploy({
    ssh: {
      host: 'example.com',
      username: 'deploy',
      privateKey: '~/.ssh/deploy_key',
      // An encrypted key can use passphrase: process.env.SSH_PASSPHRASE.
      // Password authentication can use password: process.env.SSH_PASSWORD.
    },
    log: true,
    cmds: [
      { type: 'cmd', args: ['mkdir', '-p', '/srv/app'] },
      { type: 'cmd', args: ['pm2', 'stop', 'app'], allowFailure: true },
      { type: 'upload', src: path.resolve('dist'), dest: '/srv/app' },
      { type: 'cmd', args: ['pm2', 'start', 'app'], cwd: '/srv/app' },
      { type: 'download', src: '/srv/app/deploy.log', dest: path.resolve('deploy.log') },
    ],
  })
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
```

Actions run in order. A failed action rejects `deploy()` and stops the sequence. Set `allowFailure: true` on an action to continue after its failure. The SSH connection is closed after success, action failure, or connection failure. Configurations are reusable and are not modified by execution.

The package supports both CommonJS require and native ES modules, with matching TypeScript declarations. Existing `dist/*` imports and the native ESM default API object remain available. ES module and TypeScript consumers can use named imports:

```ts
import { deploy, type IDeployConfig } from 'deploy-toolkit'
```

### Connection options

`ssh` accepts the [node-ssh connection options](https://github.com/steelbrain/node-ssh), including ssh2 options such as `hostVerifier`, `hostHash`, `agent`, and `readyTimeout`. `host` is required. `privateKey` accepts PEM key contents or a local file path; `privateKeyPath` explicitly selects a file path. Both path forms support `~/`. Choose one key option.

### Commands

```js
{
  type: 'cmd',
  args: ['printf', '%s', 'a value containing spaces'],
  cwd: '~/app',
  options: {
    stdin: 'optional input',
    execOptions: { pty: false },
    onStdout: chunk => process.stdout.write(chunk),
    onStderr: chunk => process.stderr.write(chunk),
  },
}
```

The first argument is the command; remaining arguments are shell-escaped by node-ssh. `cwd` overrides `options.cwd`; `~/` resolves on the remote server. Success is determined by exit code 0, so stderr warnings alone do not cause failure. A nonzero exit, signal, or missing exit status causes failure regardless of `options.stream`.

`options.options` remains an alias for `execOptions` for compatibility. `options.stream` remains accepted; output callbacks receive both streams and the deployment promise returns no command result.

### Uploads and downloads

```js
// A literal file maps directly to dest.
{ type: 'upload', src: '/local/app/config.json', dest: '/srv/app/config.json' }

// A literal directory uploads its contents recursively.
{ type: 'upload', src: '/local/app/dist', dest: '/srv/app' }

// A glob keeps paths relative to srcPrefix.
{
  type: 'upload',
  src: '/local/app/dist/**/*.js',
  srcPrefix: '/local/app/dist',
  dest: '/srv/app',
}

// Downloads support one file at a time.
{ type: 'download', src: '/srv/app/deploy.log', dest: '/local/deploy.log' }
```

A glob that matches multiple files requires `srcPrefix`. With a prefix, every matched file must be inside it. Remote destination paths use POSIX separators. A glob matching a single directory still uploads it recursively. Empty matches and unsuccessful directory transfers fail the action. Directory transfers retain five concurrent uploads; file lists retain parallel uploads across all matched files.

### Scripts

Scripts execute on the remote server. `cwd` selects the initial remote directory: absolute paths are used directly, relative paths start at the SSH command's default directory, and `~/` resolves to the remote user's home. An invalid directory fails before the body runs. Each new script action starts independently.

The following additional options are **unreleased**. Use them from the current source checkout until the next npm release:

```ts
{
  type: 'script',
  cwd: '/srv/app',
  shell: 'bash',
  shellArgs: ['-o', 'pipefail'],
  parseTransfers: false,
  env: { APP_ENV: 'production' },
  timeoutMs: 30_000,
  script: `
    for service in web worker; do
      ./restart.sh "$service"
    done
  `,
}
```

| Option | Behavior |
| --- | --- |
| `script` | Required shell text; CRLF line endings are normalized to LF. |
| `cwd` | Initial remote directory; later `cd` commands affect the remainder of the script. |
| `shell` | Remote interpreter name or path, default `bash`. The interpreter must be installed on the server. |
| `shebang` | Interpreter line. Priority: inline shebang, configured shebang, shell, default bash. |
| `shellArgs` | Literal interpreter arguments, such as `['-o', 'pipefail']`; nonempty arguments cannot be combined with a shebang. Keep `shell` as a name/path, rather than `bash -e`. |
| `parseTransfers` | Defaults to `true`. Set `false` to execute one shell program, preserving variables/functions and here-doc lines containing UPLOAD/DOWNLOAD. |
| `env` | String values passed literally to the interpreter and its children. Names must be valid shell variable names; values are not shell expressions. Each transfer-separated portion receives these initial values. |
| `timeoutMs` | Optional positive integer: cumulative shell execution budget for this action, including waiting for execution results, excluding connections, file transfers, and cleanup. |
| `allowFailure` | Defaults to false; continue with the next deployment action after a failure when enabled. |

Shells must support POSIX-style `set -e`, quoting, and `cd`; Bash and sh are supported. Shell conditions and pipelines keep their normal failure semantics. `shellArgs: ['-o', 'pipefail']` requires an interpreter supporting that option, such as Bash. `env` changes the script process environment, including interpreter startup; `cwd` does not interpolate environment variables.

When `timeoutMs` is set, the remote server needs GNU `timeout` or a compatible command with `--kill-after`. Its execution deadline sends TERM to the command's ordinary process group, then KILL after a one-second grace period. Cleanup and network delays can extend the total action time; this is not a connection or SFTP timeout. Detached services may escape the process group, so use the service manager to stop them. Timeout failures normally report exit code 124, or 137 after forced termination. Without `timeoutMs`, execution retains its existing unlimited behavior.

### Scripts with file transfers

```js
{
  type: 'script',
  cwd: '~/app',
  script: `
    echo starting
    UPLOAD /local/app/dist > /srv/app
    cd /srv/app
    ./restart.sh
    DOWNLOAD /srv/app/deploy.log > /local/deploy.log
    echo done
  `,
}
```

Script text supports standalone `UPLOAD source > destination` and `DOWNLOAD source > destination` lines. For glob uploads, use `UPLOAD sourcePrefix:sourcePattern > destination`. These directives use literal paths, do not expand shell variables, and do not support quoted paths or paths containing `:`/`>`; use separate upload/download actions for those cases.

Shell portions between transfer directives execute as separate temporary scripts. The current directory carries across portions; shell variables, functions, and other process state do not. Each portion uses `set -e` so ordinary command failures stop it; standard shell exceptions for conditions and pipelines still apply. Use explicit checks or Bash `set -o pipefail` when pipeline failures must be detected.

Set `shell: 'sh'` or `shebang: '#!/bin/sh'` to change the default `#!/usr/bin/env bash`. A shebang in the script takes priority. Local and remote temporary scripts are removed on success and attempted on failure.

## Local utilities

### `runShellCmd`

A promise wrapper of Node's `child_process.spawn`. Returns stdout when the process closes with code 0 and rejects with a string on spawn failure, nonzero exit, or signal termination, preserving the existing API.

```js
const { runShellCmd } = require('deploy-toolkit')
await runShellCmd('git', ['status', '--short'], { shell: false })
await runShellCmd('node', ['build.js'], { cwd: '/local/app', stdio: 'inherit', shell: false })
// Shell expressions keep working with the legacy default.
await runShellCmd('pnpm build && pnpm verify')
```

Overloads: `runShellCmd(command, options?)` and `runShellCmd(command, args?, options?)`. Options are Node's `SpawnOptions`; the default cwd is `process.cwd()` and the default `shell` remains `true`. Use `{ shell: false }` when arguments should be passed literally, especially for values from external input; shell mode concatenates arguments and interprets shell syntax.

### `findFileRecursive`

Searches the given directory and its ancestors for a file (or directory when `isDir` is true). Returns an absolute path or `''` when absent. Candidate arrays remain unchanged and are tested in order at each directory.

```js
const { findFileRecursive } = require('deploy-toolkit')
findFileRecursive('package.json')
findFileRecursive(['babel.config.js', '.babelrc'], process.cwd())
findFileRecursive('.git', process.cwd(), true)
```

### `addGitTag`

Creates a Git tag and pushes that tag to `origin`. The default name is `v${package.version}` from the nearest package.json. It rejects if validation, tagging, or pushing fails; a failed push can leave the local tag in place. This helper is never called automatically by build or publication hooks.

```js
const { addGitTag } = require('deploy-toolkit')
await addGitTag()
await addGitTag('v1.0.0-beta')
```

## Development

Use the pinned pnpm version (`packageManager` in package.json), for example via Corepack. `pnpm test:watch` starts interactive Vitest; `pnpm build` checks source, tests, and configs before generating bundles and declarations.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm audit
pnpm test:package
```

The repository pins pnpm 12.8.1 and uses TypeScript 7, Vite 8 library mode, and Vitest 5. Build/test CI validates Node 22.12, current Node 22, and Node 24; an additional tarball consumer job verifies runtime support on Node 20. Tests include an in-process SSH server and isolated local shell/file-transfer fixtures; no deployment server or real credentials are needed. Vite produces ESM (`dist/index.js`) and CommonJS (`dist/index.cjs`) bundles with runtime dependencies externalized. TypeScript emits declarations for both import and require consumers. `pnpm pack` builds `dist` automatically; generated output is not committed. `pnpm test:package` installs that tarball into an isolated consumer and verifies both runtimes and NodeNext declaration resolution. npm packages contain `dist`, documentation, license, and package metadata.
