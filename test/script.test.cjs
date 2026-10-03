const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { exec } = require('node:child_process')
const { promisify } = require('node:util')
const { runScript } = require('../dist/ssh/script')
const execute = promisify(exec)
const quote = value => "'" + value.replace(/'/g, "'\\''") + "'"

function localSSH(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-script-test-'))
  const uploaded = []
  const commands = []
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const ssh = {
    exec: async (command, args) => {
      commands.push(command)
      // Keep simulated remote files inside this test's isolated temporary directory.
      if (command === 'mktemp') command = `mktemp ${quote(path.join(root, 'remote-XXXXXX'))}`
      try {
        const result = await execute([command, ...args.map(quote)].join(' '))
        return { ...result, code: 0, signal: null }
      } catch (error) {
        return { stdout: error.stdout, stderr: error.stderr, code: error.code, signal: error.signal }
      }
    },
    putFiles: async pairs => {
      for (const pair of pairs) {
        uploaded.push(pair)
        fs.copyFileSync(pair.local, pair.remote)
      }
    },
    getFile: async (local, remote) => fs.copyFileSync(remote, local)
  }
  return { root, ssh, uploaded, commands }
}

function assertScriptsRemoved(uploaded) {
  const scripts = uploaded.filter(pair => path.basename(pair.local) === 'script')
  assert.ok(scripts.length > 0)
  for (const pair of scripts) {
    assert.equal(fs.existsSync(path.dirname(pair.local)), false)
    assert.equal(fs.existsSync(pair.remote), false)
  }
}

test('scripts preserve cwd between transfers, trim transfer paths and clean up', async t => {
  const { root, ssh, uploaded } = localSSH(t)
  const cwd = path.join(root, "space ' $(echo unsafe)")
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
  let local
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
