import type { NodeSSH as SSH } from 'node-ssh'
import fs from 'fs'
import { upload, uploadFiles, type IUploadConfig } from './upload.js'
import { download, type IDownloadConfig } from './download.js'
import path from 'path'
import os from 'os'
import sshexec from './sshexec.js'

export interface IScriptConfig {
  type: 'script'
  /** Custom shebang; a shebang in script takes priority. */
  shebang?: string
  /** Remote shell name or path, default bash; shebang takes priority. */
  shell?: string
  /** Interpreter arguments, passed literally. Nonempty arguments cannot be combined with a shebang. */
  shellArgs?: string[]
  /** Parse UPLOAD/DOWNLOAD directives, default true. Set false for plain shell text. */
  parseTransfers?: boolean
  /** Literal environment variables passed to the interpreter and its child processes. */
  env?: Record<string, string>
  /** Total shell execution budget in milliseconds, excluding file transfers and cleanup.
   * Requires remote GNU-compatible timeout; termination has a one-second kill grace period. */
  timeoutMs?: number
  /* script content */
  script: string
  /** Initial remote directory; supports relative paths and ~/ for the remote user's home. */
  cwd?: string
  /** allow failure, so the command sequence will continue to run even this failed */
  allowFailure?: boolean
}

/**
 * get script shebang: #!/bin/sh
 */
function getShebang (config: IScriptConfig) {
  const text = config.script.trim()
  if (/^#!/.test(text)) return text.split('\n')[0]
  // default 
  let shebang = '#!/usr/bin/env bash'
  if (config.shebang) {
    if (!/^#!/.test(config.shebang)) throw new TypeError(`unrecognized shebang ${config.shebang}`)
    shebang = config.shebang
  } else if (config.shell) {
    shebang = `#!/usr/bin/env ${config.shell}`
  }
  return shebang
}

function validateOptions (config: IScriptConfig) {
  if (config.parseTransfers !== undefined && typeof config.parseTransfers !== 'boolean') {
    throw new TypeError('parseTransfers must be a boolean')
  }
  if (config.shellArgs !== undefined && (!Array.isArray(config.shellArgs) || config.shellArgs.some(arg => typeof arg !== 'string' || arg.includes('\0')))) {
    throw new TypeError('shellArgs must be an array of strings without NUL characters')
  }
  if (config.shellArgs?.length && (config.shebang !== undefined || config.script.trimStart().startsWith('#!'))) {
    throw new TypeError('shellArgs cannot be combined with a configured or inline shebang')
  }
  if (config.env !== undefined) {
    if (!config.env || typeof config.env !== 'object' || Array.isArray(config.env)) throw new TypeError('env must be a map of strings')
    for (const [name, value] of Object.entries(config.env)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || typeof value !== 'string' || value.includes('\0')) {
        throw new TypeError('env requires valid shell variable names and string values without NUL characters')
      }
    }
  }
  if (config.timeoutMs !== undefined && (!Number.isSafeInteger(config.timeoutMs) || config.timeoutMs <= 0)) {
    throw new TypeError('timeoutMs must be a positive integer')
  }
}

/** Set up the interpreter and cwd; append pwd only for transfer-separated portions. */
function normalizeScript (script: string, shebang: string, options: ScriptExecutionOptions) {
  const result = script.trimStart().split('\n')
  if (!/^#!/.test(result[0])) {
    result.unshift(shebang)
  }
  // Fail before appending pwd can hide an earlier command's nonzero exit.
  const setup = ['set -e']
  if (options.cwd) setup.push(`cd -- ${shellQuote(options.cwd)}`)
  result.splice(1, 0, ...setup)
  if (options.needCwd) {
    result.push('pwd')
  }
  return result.join('\n')
}

/**
 * get the pwd when script exec successfully from its execuation result
 * @param result output result of the script exec
 */
function getLastCwd (result: string) {
  return result.replace(/\r?\n$/, '').split('\n').pop() as string
}

function shellQuote (value: string) {
  return "'" + value.replace(/'/g, "'\\''") + "'"
}

/**
 * get a temp file name on remote server
 * @param ssh ssh handler
 */
async function getTempfile (ssh: SSH) {
  const result = await sshexec(ssh, 'mktemp')
  return result.stdout.trim()
}

/**
 * set path p executable on remote server
 * @param ssh ssh handler
 * @param p file path
 */
async function chmodX (ssh: SSH, p: string) {
  const result = await sshexec(ssh, 'chmod', ['+x', p])
  return result
}

/**
 * analyze script text, extra DOWNLOAD/UPLOAD cmd
 * @param script script text
 */
type ScriptPart = { type: 'upload' | 'download', code: string } | { type: 'cmd', codes: string[] }

function analyzeScript (script: string) {
  return script.trim().split('\n').reduce((acc, cur) => {
    if (/^\s*DOWNLOAD\b(.+)$/.test(cur)) {
      acc.push({
        type: 'download',
        code: RegExp.$1
      })
    } else if (/^\s*UPLOAD\b(.+)$/.test(cur)) {
      acc.push({
        type: 'upload',
        code: RegExp.$1
      })
    } else {
      const last = acc[acc.length - 1]
      if (last && last.type === 'cmd') {
        last.codes.push(cur)
      } else {
        const cmd: ScriptPart = {
          type: 'cmd',
          codes: [cur]
        }
        acc.push(cmd)
      }
    }
    return acc
  }, [] as ScriptPart[])
}

/**
 * get download/upload config from one script
 * @param str example:  /home/user/project:dist/abc.js>/home/deploy/project1
 */
function getFileTransParams (str: string) {
  const reg = /^(?:([^:]+):)?([^:]+)\s*>\s*(\S+)$/
  if (reg.test(str.trim())) {
    return {
      srcPrefix: RegExp.$1.trim() || undefined,
      src: RegExp.$2.trim(),
      dest: RegExp.$3.trim()
    }
  }
  throw new Error(`[deploy-toolkit]invalid upload/download config in script: ${str}`)
}

/**
 * handle upload command
 * @param ssh ssh handler
 * @param code upload command args
 * @param showLog whethe to show log
 */
async function cmdUpload (ssh: SSH, code: string, showLog?: boolean) {
  const args = getFileTransParams(code)
  const cmd = Object.assign({
    type: 'upload'
  }, args) as IUploadConfig
  await upload(ssh, cmd, showLog)
}

/**
 * handle download command
 * @param ssh ssh handler
 * @param code download command args
 * @param showLog whethe to show log
 */
async function cmdDownload (ssh: SSH, code: string, showLog?: boolean) {
  const args = getFileTransParams(code)

  const cmd = Object.assign({
    type: 'download'
  }, args) as IDownloadConfig
  await download(ssh, cmd, showLog)
}

interface ScriptExecutionOptions {
  cwd?: string
  needCwd: boolean
  env?: Record<string, string>
  timeoutMs?: number
  interpreter?: { name: string, args: string[] }
}

async function runPartialScript (ssh: SSH, code: string, shebang: string, options: ScriptExecutionOptions) {
  if (options.timeoutMs !== undefined && options.timeoutMs <= 0) throw new Error('Script shell execution budget exhausted')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-'))
  let remote: string | undefined
  let completed = false
  try {
    remote = await getTempfile(ssh)
    const src = path.join(dir, 'script')
    fs.writeFileSync(src, normalizeScript(code, shebang, options), 'utf8')
    await uploadFiles(ssh, [{ local: src, remote }])
    await chmodX(ssh, remote)
    let program = options.interpreter?.name || remote
    let args = options.interpreter ? [...options.interpreter.args, remote] : []
    let command = shellQuote(program)
    const environment = Object.entries(options.env || {}).map(([name, value]) => `${name}=${value}`)
    if (environment.length) {
      args = ['--', ...environment, program, ...args]
      program = command = 'env'
    }
    if (options.timeoutMs !== undefined) {
      command = 'timeout'
      args = ['--kill-after=1s', '--', `${Math.ceil(options.timeoutMs) / 1000}s`, program, ...args]
    }
    const started = performance.now()
    const result = await sshexec(ssh, command, args, { noTrim: true })
    const elapsedMs = performance.now() - started
    completed = true
    return { stdout: result.stdout, elapsedMs }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
    if (remote) {
      try {
        await sshexec(ssh, 'rm', ['-f', '--', remote])
      } catch (error) {
        // Preserve the original error if execution or upload already failed.
        if (completed) throw error
      }
    }
  }
}

/**
 * entry function of script command
 * @param ssh ssh handler
 * @param config script command config
 * @param showLog whether show exec log
 */
export async function runScript (ssh: SSH, config: IScriptConfig, showLog?: boolean) {
  // Normalize Windows line endings without modifying a reusable configuration.
  config = { ...config, script: config.script.replace(/\r\n/g, '\n') }
  validateOptions(config)
  const shebang = getShebang(config)
  if (!/^#![^\r\n]+$/.test(shebang)) throw new TypeError('Shebang must be a single line')
  const parseTransfers = config.parseTransfers !== false
  const cmds: ScriptPart[] = parseTransfers ? analyzeScript(config.script) : [{ type: 'cmd', codes: [config.script] }]
  const hasShebang = config.shebang !== undefined || config.script.trimStart().startsWith('#!')
  const interpreter = config.shellArgs !== undefined && !hasShebang ? { name: config.shell || 'bash', args: config.shellArgs } : undefined
  let remainingTimeoutMs = config.timeoutMs
  let lastCwd = config.cwd
  if (lastCwd && /^~(?:\/|$)/.test(lastCwd)) {
    const home = await sshexec(ssh, 'printf "%s" "$HOME"')
    lastCwd = path.posix.join(home.stdout, lastCwd.slice(1))
  }
  for (let index = 0; index < cmds.length; index++) {
    const cmd = cmds[index]
    if (cmd.type === 'download') await cmdDownload(ssh, cmd.code, showLog)
    else if (cmd.type === 'upload') await cmdUpload(ssh, cmd.code, showLog)
    else if (cmd.type === 'cmd') {
      const result = await runPartialScript(ssh, cmd.codes.join('\n'), shebang, {
        cwd: lastCwd, needCwd: parseTransfers, env: config.env, interpreter, timeoutMs: remainingTimeoutMs
      })
      if (remainingTimeoutMs !== undefined) remainingTimeoutMs -= result.elapsedMs
      if (showLog) {
        console.log(result.stdout)
      }
      if (parseTransfers) lastCwd = getLastCwd(result.stdout)
    }
  }
}
