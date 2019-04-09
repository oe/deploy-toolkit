import SSH from 'node-ssh'
import fs from 'fs'
import { upload, uploadFiles, IUploadConfig } from './upload'
import { download, IDownloadConfig } from './download'
import path from 'path'
import os from 'os'

export interface IScriptConfig {
  type: 'script'
  /* custom shebang, default #!/usr/bin/env bash */
  shebang?: string
  /* shell name, default bash. if shebang specified, then shell will be used */
  shell?: string
  /* script content */
  script: string
  /* initial work dir */
  cwd?: string
  /** allow failure, so the command sequence will continue to run even this failed */
  allowFailure?: boolean
}

/**
 * get script shebang: #!/bin/sh
 */
function getShebang (config: IScriptConfig) {
  const text = config.script.trim()
  if (/^#!/.test(text)) return text
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

/**
 * normalize script, add shebang, set cwd and get pwd
 * @param script original script text
 * @param shebang default shebang
 * @param cwd the cwd which will exec the script
 * @param needCwd whether need to pwd when script exec successfully
 */
function normalizeScript (script: string, shebang: string, cwd?: string, needCwd?: boolean) {
  const result = script.trim().split('\n')
  if (!/^#!/.test(result[0])) {
    result.unshift(shebang)
  }
  if (cwd) result.splice(1, 0, `cd "${cwd}"`)
  if (needCwd) {
    result.push('pwd')
  }
  return result.join('\n')
}

/**
 * get the pwd when script exec successfully from its execuation result
 * @param result output result of the script exec
 */
function getLastCwd (result: string) {
  return result.split('\n').pop() as string
}

/**
 * get a temp file name on remote server
 * @param ssh ssh handler
 */
async function getTempfile (ssh: SSH) {
  const result = await ssh.exec('mktemp')
  return result
}

/**
 * set path p executable on remote server
 * @param ssh ssh handler
 * @param p file path
 */
async function chmodX (ssh: SSH, p: string) {
  const result = await ssh.exec('chmod', ['+x', p])
  return result
}

/**
 * analyze script text, extra DOWNLOAD/UPLOAD cmd
 * @param script script text
 */
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
        const cmd = {
          type: 'cmd',
          codes: [cur]
        }
        acc.push(cmd)
      }
    }
    return acc
  }, [] as any[])
}

/**
 * get download/upload config from one script
 * @param str example:  /home/user/project:dist/abc.js>/home/deploy/project1
 */
function getFileTransParams (str: string) {
  const reg = /^(?:([^:]+):)?([^:]+)\s*>\s*(\S+)$/
  if (reg.test(str.trim())) {
    return {
      srcPrefix: RegExp.$1,
      src: RegExp.$2,
      dest: RegExp.$3
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

/**
 * 
 * @param ssh ssh handler
 * @param code script code to exec
 * @param shebang shebang
 * @param cwd script init pwd
 * @param needCwd whether need pwd when script exec sucessfully
 */
async function runParticalScript (ssh: SSH, code: string, shebang: string, cwd?: string, needCwd?: boolean) {
  const remote = await getTempfile(ssh)
  const script = normalizeScript(code, shebang, cwd, needCwd)

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-'))
  const src = path.join(dir, 'script')
  fs.writeFileSync(src, script, 'utf8')
  await uploadFiles(ssh, [{ local: src, remote }])
  await chmodX(ssh, remote)
  const result = await ssh.exec(remote)
  return result
}

/**
 * entry function of script command
 * @param ssh ssh handler
 * @param config script command config
 * @param showLog whether show exec log
 */
export async function runScript (ssh: SSH, config: IScriptConfig, showLog?: boolean) {
  const shebang = getShebang(config)
  const cmds = analyzeScript(config.script)
  let lastCwd = config.cwd
  for (let index = 0; index < cmds.length; index++) {
    const cmd = cmds[index]
    if (cmd.type === 'download') await cmdDownload(ssh, cmd.code, showLog)
    else if (cmd.type === 'upload') await cmdUpload(ssh, cmd.code, showLog)
    else if (cmd.type === 'cmd') {
      const result = await runParticalScript(ssh, cmd.codes.join('\n'), shebang, lastCwd, true)
      if (showLog) {
        console.log(result)
      }
      lastCwd = getLastCwd(result)
    }
  }
}