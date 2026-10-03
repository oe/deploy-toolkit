import { test, vi, type TestContext } from 'vitest'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runShellCmd, findFileRecursive, addGitTag } from '../src/index.js'

test('local commands preserve literal arguments and drain all output', async () => {
  const argument = 'a b; echo injected $(echo injected)'
  assert.equal(await runShellCmd(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', argument]), argument)
  const output = await runShellCmd(process.execPath, ['-e', 'process.stdout.write("x".repeat(200000))'])
  assert.equal(output.length, 200000)
})

test('local failures include stderr, missing executables, and signals', async () => {
  await assert.rejects(runShellCmd(process.execPath, ['-e', 'console.error("failure");process.exit(7)']), /7.*failure/s)
  await assert.rejects(runShellCmd('deploy-toolkit-missing-executable'), { code: 'ENOENT' })
  await assert.rejects(runShellCmd(process.execPath, ['-e', 'process.kill(process.pid,"SIGTERM")']), /SIGTERM/)
})

test('inherited stdio and explicit shell mode work', async () => {
  assert.equal(await runShellCmd(process.execPath, ['-e', ''], { stdio: 'inherit' }), '')
  assert.equal(await runShellCmd('printf shell', { shell: true }), 'shell')
  assert.equal(await runShellCmd('printf shell', undefined, { shell: true }), 'shell')
})

test('ancestor lookup preserves candidate arrays and handles relative paths', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-lookup-'))
  t.onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'one/two'), { recursive: true })
  fs.writeFileSync(path.join(root, 'target.json'), '{}')
  const names = Object.freeze(['missing.json', 'target.json'])
  assert.equal(findFileRecursive(names, path.relative(process.cwd(), path.join(root, 'one/two'))), path.join(root, 'target.json'))
  assert.equal(findFileRecursive('one', path.join(root, 'one/two'), true), path.join(root, 'one'))
  assert.equal(findFileRecursive('dt-nonexistent-file-245932', root), '')
})

test('tag helper pushes only the selected tag to an isolated local origin', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-tag-'))
  const originalCwd = process.cwd()
  t.onTestFinished(() => { process.chdir(originalCwd); fs.rmSync(root, { recursive: true, force: true }) })
  const repository = path.join(root, 'repo')
  const origin = path.join(root, 'origin.git')
  await runShellCmd('git', ['init', '--bare', origin])
  await runShellCmd('git', ['init', repository])
  const options = { cwd: repository }
  await runShellCmd('git', ['config', 'user.name', 'Toolkit test'], options)
  await runShellCmd('git', ['config', 'user.email', 'test@example.invalid'], options)
  fs.writeFileSync(path.join(repository, 'package.json'), '{"version":"1.2.3"}')
  await runShellCmd('git', ['add', '.'], options)
  await runShellCmd('git', ['commit', '-m', 'fixture'], options)
  await runShellCmd('git', ['remote', 'add', 'origin', origin], options)
  fs.mkdirSync(path.join(repository, 'nested'))
  process.chdir(path.join(repository, 'nested'))
  assert.equal(await addGitTag(), 'v1.2.3')
  assert.equal(await runShellCmd('git', ['--git-dir', origin, 'tag']), 'v1.2.3\n')
  await assert.rejects(addGitTag('invalid tag'), /command failed/)
  assert.equal(await runShellCmd('git', ['tag']), 'v1.2.3\n')
})
