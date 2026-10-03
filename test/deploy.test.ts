import { test, vi } from 'vitest'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { generateKeyPairSync } from 'node:crypto'
import { exec } from 'node:child_process'
import { once } from 'node:events'
import { Server } from 'ssh2'
import { NodeSSH, type SSHExecOptions, type SSHExecCommandResponse } from 'node-ssh'
import type { AddressInfo } from 'node:net'
import type { Connection } from 'ssh2'
import { deploy } from '../src/index.js'

type Execute = (command: string, args: string[], options: SSHExecOptions) => Promise<SSHExecCommandResponse>

function mockConnection(execute: Execute) {
  let disposed = 0
  vi.spyOn(NodeSSH.prototype, 'connect').mockImplementation(async function (this: NodeSSH) { return this })
  vi.spyOn(NodeSSH.prototype, 'exec').mockImplementation((command, args, options = { stream: 'both' }) => execute(command, args, options))
  vi.spyOn(NodeSSH.prototype, 'dispose').mockImplementation(() => { disposed++ })
  return () => disposed
}

test('repeated deployments preserve frozen command and connection configs', async () => {
  const calls: { command: string, args: string[], options: SSHExecOptions }[] = []
  const disposed = mockConnection(async (command, args, options) => {
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
  assert.equal(vi.mocked(NodeSSH.prototype.connect).mock.calls[0][0].privateKeyPath, path.join(os.homedir(), '.ssh/example'))
})

test('nonzero exits, signals and missing exit status stop deployment', async () => {
  for (const result of [{ code: 7, signal: null }, { code: null, signal: 'TERM' }, { code: null, signal: null }]) {
    const disposed = mockConnection(async () => ({ stdout: '', stderr: '', ...result }))
    await assert.rejects(deploy({ ssh: { host: 'example.invalid' }, cmds: [{ type: 'cmd', args: ['false'] }, { type: 'cmd', args: ['next'] }] }), /Remote command failed/)
    assert.equal(vi.mocked(NodeSSH.prototype.exec).mock.calls.length, 1)
    assert.equal(disposed(), 1)
    vi.restoreAllMocks()
  }
})

test('allowFailure continues after an unsuccessful command', async () => {
  const commands: string[] = []
  const disposed = mockConnection(async command => {
    commands.push(command)
    return { code: command === 'false' ? 1 : 0, signal: null, stdout: '', stderr: '' }
  })
  await deploy({ ssh: { host: 'example.invalid' }, cmds: [{ type: 'cmd', args: ['false'], allowFailure: true }, { type: 'cmd', args: ['next'] }] })
  assert.deepEqual(commands, ['false', 'next'])
  assert.equal(disposed(), 1)
})

test('connection failures still dispose the client', async () => {
  let disposed = 0
  vi.spyOn(NodeSSH.prototype, 'connect').mockImplementation(async () => { throw new Error('authentication failed') })
  vi.spyOn(NodeSSH.prototype, 'dispose').mockImplementation(() => { disposed++ })
  await assert.rejects(deploy({ ssh: { host: 'example.invalid' }, cmds: [] }), /authentication failed/)
  assert.equal(disposed, 1)
})

test('remote home expansion and legacy exec options are copied', async () => {
  const calls: { command: string, args: string[], options: SSHExecOptions }[] = []
  mockConnection(async (command, args, options) => {
    calls.push({ command, args, options })
    return { code: 0, signal: null, stdout: '/home/deploy', stderr: '' }
  })
  const options = Object.freeze({ cwd: '~/app', options: { pty: true } })
  await deploy({ ssh: { host: 'example.invalid' }, cmds: [{ type: 'cmd', args: ['pwd'], options }] })
  assert.equal(calls[1].options.cwd, '/home/deploy/app')
  assert.deepEqual(calls[1].options.execOptions, { pty: true })
})

test('real SSH transport escapes arguments and propagates exit status', async t => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'pkcs1', format: 'pem' } })
  const clients = new Set<Connection>()
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
          channel.exit(error ? (typeof error.code === 'number' ? error.code : 1) : 0)
          channel.end()
        })
      })
    }))
  })
  t.onTestFinished(async () => {
    for (const client of clients) client.end()
    await new Promise<void>(resolve => server.close(() => resolve()))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const ssh = { host: '127.0.0.1', port: (server.address() as AddressInfo).port, username: 'test', password: 'test' }
  let output = ''
  const args = ['printf', '%s', 'a b; echo unexpected $(echo unexpected)']
  await deploy({ ssh, cmds: [{ type: 'cmd', args, options: { onStdout: chunk => { output += chunk } } }] })
  assert.equal(output, args[2])
  await assert.rejects(deploy({ ssh, cmds: [{ type: 'cmd', args: ['false'] }] }), /Remote command failed \(1\)/)
}, 15000)
