import { test, vi, type TestContext } from 'vitest'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { NodeSSH } from 'node-ssh'
import type { IUploadConfig } from '../src/ssh/upload.js'
import { upload } from '../src/ssh/upload.js'

type FilePair = { local: string, remote: string }

function fixture(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-upload-'))
  fs.mkdirSync(path.join(root, 'dist/sub'), { recursive: true })
  fs.writeFileSync(path.join(root, 'dist/a.txt'), 'a')
  fs.writeFileSync(path.join(root, 'dist/sub/b.txt'), 'b')
  t.onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }))
  return root
}

test('glob upload uses relative prefix paths on POSIX remote hosts', async t => {
  const root = fixture(t)
  let pairs: FilePair[] = []
  const ssh = new NodeSSH()
  vi.spyOn(ssh, 'putFiles').mockImplementation(async files => { pairs = files })
  await upload(ssh, { type: 'upload', src: `${root}/dist/**/*.txt`, srcPrefix: path.join(root, 'dist'), dest: '/srv/app' })
  assert.deepEqual(pairs.map(pair => pair.remote), ['/srv/app/a.txt', '/srv/app/sub/b.txt'])
})

test('prefix escapes and missing prefixes fail before upload', async t => {
  const root = fixture(t)
  const ssh = new NodeSSH()
  vi.spyOn(ssh, 'putFiles').mockImplementation(async () => assert.fail('must not upload'))
  await assert.rejects(upload(ssh, { type: 'upload', src: `${root}/dist/**/*.txt`, srcPrefix: path.join(root, 'other'), dest: '/srv/app' }), /outside srcPrefix/)
  await assert.rejects(upload(ssh, { type: 'upload', src: `${root}/dist/**/*.txt`, dest: '/srv/app' }), /srcPrefix/)
  await assert.rejects(upload(ssh, { type: 'upload', src: `${root}/missing/*`, dest: '/srv/app' }), /No files found/)
})

test('literal single files containing brackets keep their destination', async t => {
  const root = fixture(t)
  const local = path.join(root, '[literal].txt')
  fs.writeFileSync(local, 'literal')
  let pairs: FilePair[] = []
  const ssh = new NodeSSH()
  vi.spyOn(ssh, 'putFiles').mockImplementation(async files => { pairs = files })
  await upload(ssh, { type: 'upload', src: local, dest: '/srv/file.txt' })
  assert.deepEqual(pairs, [{ local, remote: '/srv/file.txt' }])
})

test('directory upload reports a false result or tick errors', async t => {
  const root = fixture(t)
  const config: IUploadConfig = { type: 'upload', src: path.join(root, 'dist'), dest: '/srv/app' }
  const ssh = new NodeSSH()
  const putDirectory = vi.spyOn(ssh, 'putDirectory').mockResolvedValue(false)
  await assert.rejects(upload(ssh, config), /Failed to upload directory/)
  putDirectory.mockImplementation(async (local, remote, options) => {
    options?.tick?.(local, remote, new Error('transfer failed'))
    return true
  })
  await assert.rejects(upload(ssh, config), /transfer failed/)
  putDirectory.mockResolvedValue(true)
  await upload(ssh, config)
})
