import SSH from 'node-ssh'
import fs from 'fs'
import { upload, uploadFiles, IUploadConfig } from './upload'
import { download, IDownloadConfig } from './download'
import path from 'path'
import os from 'os'

export interface IScriptConfig {
  type: 'script'
  /* shell name, default bash */
  shell?: string
  /* custom shebang, default #!/usr/bin/env bash */
  shebang?: string
  /* script content */
  script: string
  /* initial work dir */
  cwd: string
  /** allow failure, so the command sequence will continue to run even this failed */
  allowFailure?: boolean
}

function getShebang (config: IScriptConfig) {
  const text = config.script.trim()
  if (/^#!/.test(text)) return text
  let shebang = '#!/usr/bin/env bash'
  if (config.shebang) {
    if (!/^#!/.test(config.shebang)) throw new TypeError(`unrecognized shebang ${config.shebang}`)
    shebang = config.shebang
  } else if (config.shell) {
    shebang = `#!/usr/bin/env ${config.shell}`
  }
  return shebang
}

function normalizeScript (script: string, shebang: string, cwd: string, needPwd?: boolean) {
  const result = script.trim().split('\n')
  if (!/^#!/.test(result[0])) {
    result.unshift(shebang)
  }
  result.splice(1, 0, `cd "${cwd}"`)
  if (needPwd) {
    result.push('pwd')
  }
  return result.join('\n')
}

function getLastPwd (result: string) {
  return result.split('\n').pop() as string
}

async function getTempfile (ssh: SSH) {
  const result = await ssh.exec('mktemp')
  return result
}

async function chmodX (ssh: SSH, p: string) {
  const result = await ssh.exec('chmod', ['+x', p])
  return result
}


function analyzeScript (script: string) {
  return script.trim().split('\n').reduce((acc, cur) => {
    if (/^DOWNLOAD/.test(cur)) {
      acc.push({
        type: 'download',
        code: cur
      })
    } else if (/^UPLOAD/.test(cur)) {
      acc.push({
        type: 'upload',
        code: cur
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

function getParams (str: string) {
  const result: string[] = []
  str = str.trim()
  let last = ''
  let sep: RegExp
  for (let index = 0; index < str.length; index++) {
    const element = str[index]
    if (!last) {
      if (/\s/.test(element)) continue
      sep = /"|'/.test(element) ? RegExp(element) : /\s/
      last = ' '
    } else {
      if (sep!.test(element)) {
        if (last === ' ') continue
        result.push(last)
        last = ''
      } else {
        last += element
      }
    }
  }
  return result.map(l => l.replace(/^ /, ''))
}

async function cmdUpload (ssh: SSH, code: string, showLog?: boolean) {
  const args = getParams(code)
  if (args.length <= 3) throw new Error('invalid download config:' + code)
  const src = args[1].split(':')

  const cmd: IUploadConfig = {
    type: 'upload',
    src: src[0],
    srcPrefix: src[1],
    dest: args[2]
  }
  await upload(ssh, cmd, showLog)
}

async function cmdDownload (ssh: SSH, code: string, showLog?: boolean) {
  const args = getParams(code)
  if (args.length <= 3) throw new Error('invalid download config:' + code)

  const cmd: IDownloadConfig = {
    type: 'download',
    src: args[1],
    dest: args[2]
  }
  await download(ssh, cmd, showLog)
}

async function runCmd (ssh: SSH, code: string, shebang: string, lastCwd: string, needPwd?: boolean) {
  const remote = await getTempfile(ssh)
  const script = normalizeScript(code, shebang, lastCwd, needPwd)

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-'))
  console.log('sh dir', dir, remote)
  const src = path.join(dir, 'script')
  fs.writeFileSync(src, script, 'utf8')
  await uploadFiles(ssh, [{ local: src, remote }])
  await chmodX(ssh, remote)
  const result = await ssh.exec(remote)
  return result
}

/** exec remote command */
export async function runScript (ssh: SSH, config: IScriptConfig, showLog?: boolean) {
  const shebang = getShebang(config)
  const cmds = analyzeScript(config.script)
  let lastCwd = config.cwd
  for (let index = 0; index < cmds.length; index++) {
    const cmd = cmds[index]
    if (cmd.type === 'download') await cmdDownload(ssh, cmd.code, showLog)
    else if (cmd.type === 'upload') await cmdUpload(ssh, cmd.code, showLog)
    else if (cmd.type === 'cmd') {
      const result = await runCmd(ssh, cmd.codes.join('\n'), shebang, lastCwd, true)
      if (showLog) {
        console.log(result)
      }
      lastCwd = getLastPwd(result)
    }
  }
}