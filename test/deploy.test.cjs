const { test } = require('node:test')
const assert = require('node:assert/strict')
const os = require('node:os')
const path = require('node:path')
const { generateKeyPairSync } = require('node:crypto')
const { exec } = require('node:child_process')
const { once } = require('node:events')
const { Server } = require('ssh2')
const { NodeSSH } = require('node-ssh')
const { deploy } = require('../dist')

function mockConnection(t, execute) {
  let disposed = 0
  t.mock.method(NodeSSH.prototype, 'connect', async function () { return this })
  t.mock.method(NodeSSH.prototype, 'exec', execute)
  t.mock.method(NodeSSH.prototype, 'dispose', () => { disposed++ })
  return () => disposed
}

test('repeated deployments preserve frozen command and connection configs', async t => {
  const calls = []
  const disposed = mockConnection(t, async (command, args, options) => {
    calls.push({ command, args, options })
    return { code: 0, signal: null, stdout: 'ok', stderr: 'harmless warning' }
  })
  const config = Object.freeze({
    ssh: Object.freeze({ host: 'example.invalid', privateKey: '~/.ssh/example' }),
    cmds: Object.freeze([Object.freeze({ type: 'cmd', args: Object.freeze(['printf', 'hello world']), cwd: '/tmp', options: Object.freeze({ cwd: '/' }) })])
  })
  await deploy(config)
  await deploy(config)
  assert.equal(disposed(), 2)
  assert.deepEqual(calls.map(call => call.args), [['hello world'], ['hello world']])
  assert.equal(calls[0].options.cwd, '/tmp')
  assert.equal(NodeSSH.prototype.connect.mock.calls[0].arguments[0].privateKeyPath, path.join(os.homedir(), '.ssh/example'))
})

test('nonzero exits, signals and missing exit status stop deployment', async t => {
  for (const result of [{ code: 7, signal: null }, { code: null, signal: 'TERM' }, { code: null, signal: null }]) {
    const disposed = mockConnection(t, async () => ({ stdout: '', stderr: '', ...result }))
    await assert.rejects(deploy({ ssh: { host: 'example.invalid' }, cmds: [{ type: 'cmd', args: ['false'] }, { type: 'cmd', args: ['next'] }] }), /Remote command failed/)
    assert.equal(NodeSSH.prototype.exec.mock.callCount(), 1)
    assert.equal(disposed(), 1)
    t.mock.restoreAll()
  }
})

test('allowFailure continues after an unsuccessful command', async t => {
  const commands = []
  const disposed = mockConnection(t, async command => {
    commands.push(command)
    return { code: command === 'false' ? 1 : 0, signal: null, stdout: '', stderr: '' }
  })
  await deploy({ ssh: { host: 'example.invalid' }, cmds: [{ type: 'cmd', args: ['false'], allowFailure: true }, { type: 'cmd', args: ['next'] }] })
  assert.deepEqual(commands, ['false', 'next'])
  assert.equal(disposed(), 1)
})

test('connection failures still dispose the client', async t => {
  let disposed = 0
  t.mock.method(NodeSSH.prototype, 'connect', async () => { throw new Error('authentication failed') })
  t.mock.method(NodeSSH.prototype, 'dispose', () => { disposed++ })
  await assert.rejects(deploy({ ssh: { host: 'example.invalid' }, cmds: [] }), /authentication failed/)
  assert.equal(disposed, 1)
})

test('remote home expansion and legacy exec options are copied', async t => {
  const calls = []
  mockConnection(t, async (command, args, options) => {
    calls.push({ command, args, options })
    return { code: 0, signal: null, stdout: '/home/deploy', stderr: '' }
  })
  const options = Object.freeze({ cwd: '~/app', options: { pty: true } })
  await deploy({ ssh: { host: 'example.invalid' }, cmds: [{ type: 'cmd', args: ['pwd'], options }] })
  assert.equal(calls[1].options.cwd, '/home/deploy/app')
  assert.deepEqual(calls[1].options.execOptions, { pty: true })
})

test('real SSH transport escapes arguments and propagates exit status', { timeout: 15000 }, async t => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'pkcs1', format: 'pem' } })
  const clients = new Set()
  const server = new Server({ hostKeys: [privateKey] }, client => {
    clients.add(client)
    client.on('error', () => {})
    client.on('close', () => clients.delete(client))
    client.on('authentication', context => context.accept())
    client.on('ready', () => client.on('session', accept => {
      accept().on('exec', (acceptExec, reject, info) => {
        const channel = acceptExec()
        exec(info.command, (error, stdout, stderr) => {
          channel.write(stdout)
          channel.stderr.write(stderr)
          channel.exit(error ? (error.code || 1) : 0)
          channel.end()
        })
      })
    }))
  })
  t.after(async () => {
    for (const client of clients) client.end()
    await new Promise(resolve => server.close(resolve))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const ssh = { host: '127.0.0.1', port: server.address().port, username: 'test', password: 'test' }
  let output = ''
  const args = ['printf', '%s', 'a b; echo unexpected $(echo unexpected)']
  await deploy({ ssh, cmds: [{ type: 'cmd', args, options: { onStdout: chunk => { output += chunk } } }] })
  assert.equal(output, args[2])
  await assert.rejects(deploy({ ssh, cmds: [{ type: 'cmd', args: ['false'] }] }), /Remote command failed \(1\)/)
})
