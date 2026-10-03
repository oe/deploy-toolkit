import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const directory = mkdtempSync(path.join(os.tmpdir(), 'dt-package-'))
const pnpm = process.env.npm_execpath
assert.ok(pnpm, 'Run this check with pnpm test:package')
const pnpmCommand = /\.[cm]?js$/.test(pnpm) ? process.execPath : pnpm
const pnpmPrefix = pnpmCommand === process.execPath ? [pnpm] : []

function run(command, args, cwd = directory) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stdout + result.stderr)
  return result.stdout
}

try {
  run(pnpmCommand, [...pnpmPrefix, 'pack', '--pack-destination', directory], root)
  const store = path.dirname(run(pnpmCommand, [...pnpmPrefix, 'store', 'path'], root).trim())
  const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  const tarball = path.join(directory, `deploy-toolkit-${version}.tgz`)
  writeFileSync(path.join(directory, 'package.json'), JSON.stringify({
    name: 'deploy-toolkit-consumer', private: true,
    dependencies: { 'deploy-toolkit': `file:${tarball}` },
  }))
  // A consumer needs registry metadata to resolve the package's public dependency ranges.
  run(pnpmCommand, [...pnpmPrefix, 'install', '--prod', '--ignore-scripts',
    '--store-dir', store, '--package-import-method=copy'])
  const check = `
    for (const name of ['deploy', 'runShellCmd', 'findFileRecursive', 'addGitTag']) {
      assert.equal(typeof toolkit[name], 'function')
    }
    assert.equal(await toolkit.runShellCmd(process.execPath, ['-e', 'process.stdout.write("ok")']), 'ok')
  `
  writeFileSync(path.join(directory, 'consumer.mjs'), `import assert from 'node:assert/strict'; import * as toolkit from 'deploy-toolkit'; ${check}`)
  writeFileSync(path.join(directory, 'consumer.cjs'), `const assert = require('node:assert/strict'); const toolkit = require('deploy-toolkit'); (async () => { ${check} })().catch(error => { console.error(error); process.exitCode = 1 })`)
  run(process.execPath, ['consumer.mjs'])
  run(process.execPath, ['consumer.cjs'])
  const types = `
    import { deploy, runShellCmd, findFileRecursive, addGitTag, type IDeployConfig } from 'deploy-toolkit'
    const config: IDeployConfig = { ssh: { host: 'example.invalid' }, cmds: [{ type: 'cmd', args: ['printf', 'ok'] }] }
    void [deploy, runShellCmd, findFileRecursive, addGitTag, config]
  `
  writeFileSync(path.join(directory, 'consumer.mts'), types)
  writeFileSync(path.join(directory, 'consumer.cts'), types)
  // Use the producer's compiler, with all declaration dependencies from the consumer install.
  run(path.join(root, 'node_modules', '.bin', 'tsc'), [
    '--strict', '--noEmit', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
    '--target', 'es2022', 'consumer.mts', 'consumer.cts',
  ])
  console.log('Packed ESM/CommonJS runtime and NodeNext declarations verified')
} finally {
  rmSync(directory, { recursive: true, force: true })
}
