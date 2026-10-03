const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { upload } = require('../dist/ssh/upload')

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-upload-'))
  fs.mkdirSync(path.join(root, 'dist/sub'), { recursive: true })
  fs.writeFileSync(path.join(root, 'dist/a.txt'), 'a')
  fs.writeFileSync(path.join(root, 'dist/sub/b.txt'), 'b')
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return root
}

test('glob upload uses relative prefix paths on POSIX remote hosts', async t => {
  const root = fixture(t)
  let pairs
  await upload({ putFiles: async files => { pairs = files } }, { type: 'upload', src: `${root}/dist/**/*.txt`, srcPrefix: path.join(root, 'dist'), dest: '/srv/app' })
  assert.deepEqual(pairs.map(pair => pair.remote), ['/srv/app/a.txt', '/srv/app/sub/b.txt'])
})

test('prefix escapes and missing prefixes fail before upload', async t => {
  const root = fixture(t)
  const ssh = { putFiles: async () => assert.fail('must not upload') }
  await assert.rejects(upload(ssh, { type: 'upload', src: `${root}/dist/**/*.txt`, srcPrefix: path.join(root, 'other'), dest: '/srv/app' }), /outside srcPrefix/)
  await assert.rejects(upload(ssh, { type: 'upload', src: `${root}/dist/**/*.txt`, dest: '/srv/app' }), /srcPrefix/)
  await assert.rejects(upload(ssh, { type: 'upload', src: `${root}/missing/*`, dest: '/srv/app' }), /No files found/)
})

test('literal single files containing brackets keep their destination', async t => {
  const root = fixture(t)
  const local = path.join(root, '[literal].txt')
  fs.writeFileSync(local, 'literal')
  let pairs
  await upload({ putFiles: async files => { pairs = files } }, { type: 'upload', src: local, dest: '/srv/file.txt' })
  assert.deepEqual(pairs, [{ local, remote: '/srv/file.txt' }])
})

test('directory upload reports a false result or tick errors', async t => {
  const root = fixture(t)
  const config = { type: 'upload', src: path.join(root, 'dist'), dest: '/srv/app' }
  await assert.rejects(upload({ putDirectory: async () => false }, config), /Failed to upload directory/)
  await assert.rejects(upload({ putDirectory: async (local, remote, options) => { options.tick(local, remote, new Error('transfer failed')); return true } }, config), /transfer failed/)
  await upload({ putDirectory: async () => true }, config)
})
