import { test, vi, type TestContext } from 'vitest'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { exec, type ExecException } from 'node:child_process'
import { NodeSSH } from 'node-ssh'
import { promisify } from 'node:util'
import { runScript } from '../src/ssh/script.js'
import { deploy, type IScriptConfig } from '../src/index.js'
type FilePair = { local: string, remote: string }

const execute = promisify(exec)
const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'"

function localSSH(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-script-test-'))
  const uploaded: FilePair[] = []
  const commands: string[] = []
  t.onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }))
  const ssh = new NodeSSH()
  vi.spyOn(ssh, 'exec').mockImplementation(async (command, args) => {
    commands.push(command)
    // Keep simulated remote files inside this test's isolated temporary directory.
    if (command === 'mktemp') command = `mktemp ${quote(path.join(root, 'remote-XXXXXX'))}`
    try {
      const result = await execute([command, ...args.map(quote)].join(' '), { cwd: root })
      return { ...result, code: 0, signal: null }
    } catch (error) {
      const failure = error as ExecException & { stdout: string, stderr: string }
      return { stdout: failure.stdout, stderr: failure.stderr, code: typeof failure.code === 'number' ? failure.code : null, signal: failure.signal || null }
    }
  })
  vi.spyOn(ssh, 'putFiles').mockImplementation(async pairs => {
    for (const pair of pairs) {
      uploaded.push(pair)
      fs.copyFileSync(pair.local, pair.remote)
    }
  })
  vi.spyOn(ssh, 'getFile').mockImplementation(async (local, remote) => fs.copyFileSync(remote, local))
  return { root, ssh, uploaded, commands }
}

function assertScriptsRemoved(uploaded: FilePair[]) {
  const scripts = uploaded.filter(pair => path.basename(pair.local) === 'script')
  assert.ok(scripts.length > 0)
  for (const pair of scripts) {
    assert.equal(fs.existsSync(path.dirname(pair.local)), false)
    assert.equal(fs.existsSync(pair.remote), false)
  }
}

test('scripts preserve cwd between transfers, trim transfer paths and clean up', async t => {
  const { root, ssh, uploaded } = localSSH(t)
  const cwd = path.join(root, "space ' $(echo unsafe) ")
  fs.mkdirSync(cwd)
  const source = path.join(root, 'source.txt')
  const remote = path.join(root, 'data.txt')
  const downloaded = path.join(root, 'downloaded.txt')
  fs.writeFileSync(source, 'payload')
  await runScript(ssh, {
    type: 'script', cwd: root,
    script: `#!/bin/sh\ncd ${quote(cwd)}\nUPLOAD ${source} > ${remote}\ntest "$PWD" = ${quote(cwd)}\nDOWNLOAD ${remote} > ${downloaded}\ntest "$PWD" = ${quote(cwd)}`
  })
  assert.equal(fs.readFileSync(downloaded, 'utf8'), 'payload')
  assertScriptsRemoved(uploaded)
})

test('failed scripts stop before transfers and clean up both temporary copies', async t => {
  const { ssh, uploaded } = localSSH(t)
  await assert.rejects(runScript(ssh, { type: 'script', script: 'false\necho should-not-run\nDOWNLOAD /missing > /missing' }), /Remote command failed \(1\)/)
  assertScriptsRemoved(uploaded)
})

test('invalid cwd fails before executing script commands', async t => {
  const { root, ssh, uploaded } = localSSH(t)
  const marker = path.join(root, 'marker')
  await assert.rejects(runScript(ssh, { type: 'script', cwd: path.join(root, 'missing'), script: `touch ${quote(marker)}` }), /Remote command failed/)
  assert.equal(fs.existsSync(marker), false)
  assertScriptsRemoved(uploaded)
})

test('upload failures preserve the error and still remove temporary files', async t => {
  const { root, ssh } = localSSH(t)
  let local = ''
  ssh.putFiles = async pairs => { local = pairs[0].local; throw new Error('SFTP unavailable') }
  await assert.rejects(runScript(ssh, { type: 'script', script: 'echo hello' }), /SFTP unavailable/)
  assert.equal(fs.existsSync(path.dirname(local)), false)
  assert.deepEqual(fs.readdirSync(root), [])
})

test('tilde cwd resolves to the remote home', async t => {
  const { ssh, uploaded } = localSSH(t)
  await runScript(ssh, { type: 'script', cwd: '~', script: 'test "$PWD" = "$HOME"' })
  assertScriptsRemoved(uploaded)
})

test('invalid shebang and transfer syntax fail clearly', async t => {
  const { ssh } = localSSH(t)
  await assert.rejects(runScript(ssh, { type: 'script', shebang: 'bash', script: 'echo ok' }), /unrecognized shebang/)
  await assert.rejects(runScript(ssh, { type: 'script', shebang: '#!/bin/sh\necho unsafe', script: 'echo ok' }), /single line/)
  await assert.rejects(runScript(ssh, { type: 'script', script: 'UPLOAD invalid' }), /invalid upload\/download config/)
})

test('plain scripts preserve heredocs and shell state without parsing transfer words', async t => {
  const { root, ssh, uploaded } = localSSH(t)
  const output = path.join(root, 'literal.txt')
  await runScript(ssh, {
    type: 'script', parseTransfers: false, cwd: root,
    script: `v=ok
for i in 1 2; do test "$v" = ok; done
cat > ${quote(output)} <<'TEXT'
UPLOAD sample text
DOWNLOAD literal > text
${'  trailing spaces  '}
TEXT
`
  })
  assert.equal(fs.readFileSync(output, 'utf8'), 'UPLOAD sample text\nDOWNLOAD literal > text\n  trailing spaces  \n')
  assert.equal(uploaded.length, 1)
  assertScriptsRemoved(uploaded)
})

test('CRLF scripts preserve shell priority and relative cwd', async t => {
  const { root, ssh, uploaded } = localSSH(t)
  fs.mkdirSync(path.join(root, 'nested'))
  for (const shell of ['bash', 'sh', '/bin/sh']) {
    await runScript(ssh, { type: 'script', shell, cwd: 'nested', parseTransfers: false,
      script: `test "$PWD" = ${quote(path.join(root, 'nested'))}\r\n` })
  }
  await runScript(ssh, { type: 'script', shell: 'missing-shell', shebang: '#!/also-missing',
    script: '#!/bin/sh\r\ntest 1 -eq 1\r\n' })
  await runScript(ssh, { type: 'script', shell: 'missing-shell', shebang: '#!/bin/sh', script: 'true' })
  assertScriptsRemoved(uploaded)
})

test('interpreter options enable pipefail and reject ambiguous shebang combinations', async t => {
  const { root, ssh, uploaded } = localSSH(t)
  const marker = path.join(root, 'must-not-run')
  await assert.rejects(runScript(ssh, { type: 'script', shell: '/bin/bash', shellArgs: ['-o', 'pipefail'],
    script: `false | true\ntouch ${quote(marker)}` }), /Remote command failed/)
  assert.equal(fs.existsSync(marker), false)
  for (const config of [{ shebang: '#!/bin/bash', script: 'true' }, { script: '#!/bin/bash\ntrue' }]) {
    await assert.rejects(runScript(ssh, { type: 'script', shellArgs: ['-u'], ...config }), /shellArgs.*shebang/)
  }
  assertScriptsRemoved(uploaded)
})

test('environment and interpreter arguments remain literal and configs stay reusable', async t => {
  const { root, ssh, uploaded } = localSSH(t)
  const marker = path.join(root, 'injection')
  const literal = `a b ' ; $(touch ${quote(marker)})\nsecond line`
  const interpreter = path.join(root, 'shell with spaces')
  const startup = path.join(root, 'startup.sh')
  fs.writeFileSync(startup, 'export STARTUP_SEEN=yes\n')
  fs.writeFileSync(interpreter, '#!/bin/sh\ntest "$1" = "$VALUE"\nshift\nexec /bin/bash "$@"\n', { mode: 0o700 })
  const output = path.join(root, 'env-output')
  const config: IScriptConfig = {
    type: 'script', shell: interpreter, shellArgs: [literal], parseTransfers: false, cwd: root,
    env: { VALUE: literal, BASH_ENV: startup }, timeoutMs: 2000,
    script: `test "$STARTUP_SEEN" = yes\n/bin/sh -c 'printf "%s" "$VALUE"' > ${quote(output)}`
  }
  Object.freeze(config.env)
  Object.freeze(config.shellArgs)
  Object.freeze(config)
  await runScript(ssh, config)
  await runScript(ssh, config)
  assert.equal(fs.readFileSync(output, 'utf8'), literal)
  assert.equal(fs.existsSync(marker), false)
  await runScript(ssh, { type: 'script', script: 'test "${STARTUP_SEEN-unset}" = unset' })
  assertScriptsRemoved(uploaded)
})

test('timeouts stop ordinary child processes and clean up before returning', async t => {
  const { root, ssh, uploaded } = localSSH(t)
  const marker = path.join(root, 'child-must-not-finish')
  await assert.rejects(runScript(ssh, { type: 'script', parseTransfers: false, timeoutMs: 100,
    script: `(sleep 0.5; touch ${quote(marker)}) &\nwait` }), /Remote command failed \(124\)/)
  assertScriptsRemoved(uploaded)
  await new Promise(resolve => setTimeout(resolve, 650))
  assert.equal(fs.existsSync(marker), false)
})

test('timeout escalates to kill when the script ignores termination', async t => {
  const { ssh, uploaded } = localSSH(t)
  await assert.rejects(runScript(ssh, { type: 'script', parseTransfers: false, timeoutMs: 100,
    script: "trap '' TERM\nsleep 30" }), /Remote command failed \((137|KILL)\)/)
  assertScriptsRemoved(uploaded)
})

test('transfer-separated portions share one shell execution budget', async t => {
  const { root, ssh, uploaded } = localSSH(t)
  const source = path.join(root, 'source')
  const remote = path.join(root, 'payload')
  const marker = path.join(root, 'must-not-finish')
  fs.writeFileSync(source, 'payload')
  await assert.rejects(runScript(ssh, { type: 'script', timeoutMs: 700,
    script: `sleep 0.3\nUPLOAD ${source} > ${remote}\nsleep 0.6\ntouch ${quote(marker)}` }), /Remote command failed \(124\)/)
  assert.equal(fs.readFileSync(remote, 'utf8'), 'payload')
  assert.equal(fs.existsSync(marker), false)
  assertScriptsRemoved(uploaded)
})

test('allowFailure continues deployment after a timed-out script is cleaned up', async t => {
  const { root, ssh, uploaded } = localSSH(t)
  vi.spyOn(NodeSSH.prototype, 'connect').mockImplementation(async function (this: NodeSSH) { return this })
  vi.spyOn(NodeSSH.prototype, 'exec').mockImplementation((command, args, options) => ssh.exec(command, args, options))
  vi.spyOn(NodeSSH.prototype, 'putFiles').mockImplementation((pairs, options) => ssh.putFiles(pairs, options))
  const dispose = vi.spyOn(NodeSSH.prototype, 'dispose')
  const marker = path.join(root, 'next-action')
  await deploy({ ssh: { host: 'example.invalid' }, cmds: [
    { type: 'script', parseTransfers: false, timeoutMs: 100, script: 'sleep 30', allowFailure: true },
    { type: 'cmd', args: ['touch', marker] }
  ] })
  assert.equal(fs.existsSync(marker), true)
  assert.equal(dispose.mock.calls.length, 1)
  assertScriptsRemoved(uploaded)
})

test('invalid new options fail before remote operations without exposing env values', async t => {
  const { ssh, commands } = localSSH(t)
  for (const options of [
    { parseTransfers: 'false' }, { shellArgs: 'bash -e' }, { shellArgs: ['\0'] },
    { env: { 'INVALID-NAME': 'private-value' } }, { env: { VALID: 1 } }, { env: { VALID: '\0' } }, { env: null },
    ...[0, -1, 1.5, NaN, Infinity, '100'].map(timeoutMs => ({ timeoutMs }))
  ]) {
    await assert.rejects(runScript(ssh, { type: 'script', script: 'true', ...options } as unknown as IScriptConfig), error => {
      assert.ok(error instanceof TypeError)
      assert.equal(error.message.includes('private-value'), false)
      return true
    })
  }
  assert.equal(commands.length, 0)
})
