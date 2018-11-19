// 自动上传安装包到测试服务器

import SSH from 'node-ssh'
import glob from 'glob'
import fs from 'fs'
import path from 'path'

/** 上传配置 */
export interface IUploadConfig {
  type: 'upload'
  /** source file(in local), could be a specified file path, directory path or a glob pattern */
  src: string
  /** if src is a glob pattern, then srcPrefix is need, to determine the path save on server */
  srcPrefix?: string
  /** destination path(on server), should be a file path if src is a specified file, or a directory for other situations */
  dest: string
}

/** download config */
export interface IDownloadConfig {
  type: 'download'
  /** source file path(on server) */
  src: string
  /** dest save path(in local) */
  dest: string
}

/** custom command */
export interface IRunConfig {
  type: 'cmd'
  /** cmd arguments */
  args: string[]
  /** options */
  options?: any,
  /** cmd work directory */
  cwd?: string
}

/** command */
export type ICmd = IUploadConfig | IDownloadConfig | IRunConfig
/** commands sequence */
export type ICmds = ICmd[]

/** SSH Connection config */
export interface ISshConfig {
  host: string
  port?: number
  username: string
  password?: string
  passphrase?: string
  privateKey?: string
}

/** deploy confgi */
export interface IDeployConfig {
  /** ssh connection config */
  ssh: ISshConfig
  /** whether to show log when executing cmds */
  log?: boolean
  /** command sequence */
  cmds: ICmds
}

interface IFilePair {
  /** file in local path */
  local: string
  /** file in remote(server) path */
  remote: string
}

type IFilePairs = IFilePair[]

/** entrance */
export default async function deploy (deployCmd: IDeployConfig) {
  let ssh: SSH
  try {
    const showLog = !!deployCmd.log
    ssh = await getSshClient(deployCmd.ssh, showLog)
    const cmds = deployCmd.cmds
    for (let index = 0; index < cmds.length; index++) {
      const cmd = cmds[index]
      switch (cmd.type) {
        case 'cmd':
          await runSSHCmd(ssh, cmd, showLog)
          break
        case 'upload':
          await upload(ssh, cmd, showLog)
          break
        case 'download':
          await download(ssh, cmd, showLog)
          break
        default:
          throw new TypeError(`unsupported cmd ${JSON.stringify(cmd)}`)
      }
    }
    // close connection
    ssh.dispose()
  } catch (error) {
    // close connection even error occured 
    if (ssh && ssh.dispose) {
      ssh.dispose()
    }
    throw error
  }
}

/** get SSH object */
async function getSshClient (config: ISshConfig, showLog: boolean) {
  const ssh = new SSH()
  if (showLog) {
    console.log(`[deploy][connnect] connect to \`${config.host}\` as user \`${config.username}\``)
  }
  await ssh.connect(config)
  return ssh
}

/** exec remote command */
async function runSSHCmd (ssh: SSH, cmd: IRunConfig, showLog: boolean) {
  const options = cmd.options || { stream: 'stdout' }
  if (cmd.cwd) options.cwd = cmd.cwd
  if (showLog) {
    console.log('[deploy][cmd] `', cmd.args.join(' '), '` with cwd', cmd.cwd)
  }
  const result = await ssh.exec(cmd.args.shift(), cmd.args, options)
  if (showLog) {
    console.log('[deploy][cmd] command result:')
    console.log(result)
  }
}

/** upload files and directory */
async function upload (ssh: SSH, cmd: IUploadConfig, showLog: boolean) {
  const srcfiles = await getLocalFile(cmd.src, false)
  if (showLog) {
    console.log('[deploy][upload]upload file with config', cmd)
  }
  if (!srcfiles.length) {
    if (showLog) {
      console.warn('[deploy][upload][warn]can not find any file to upload with config', cmd)
    }
    return
  }
  if (srcfiles.length === 1 && fs.statSync(srcfiles[0]).isDirectory()) {
    const src = srcfiles[0]
    if (showLog) {
      console.log(`[deploy][upload] try to upload dir from \`${src}\` to \`${cmd.dest}\``)
    }
    await uploadDir(ssh, src, cmd.dest)
    return
  }
  const filePairs = getFilePairs(srcfiles, cmd)
  if (showLog) {
    console.log('[deploy][upload] try to upload files', filePairs)
  }
  await uploadFiles(ssh, filePairs)
}

/** download a single file */
async function download (ssh: SSH, cmd: IDownloadConfig, showLog: boolean) {
  if (showLog) {
    console.log('[deploy][download]download file with config', cmd)
  }
  await ssh.getFile(cmd.dest, cmd.src)
}

/** upload folder */
async function uploadDir (ssh: SSH, srcDir: string, destDir: string) {
  const failed: string[] = []
  await ssh.putDirectory(srcDir, destDir, {
    recursive: true,
    tick: function (localPath, remotePath, error) {
      if (error) {
        failed.push(`[error]failed to push ${localPath} to ${remotePath}, because of ${error.message}`)
      }
    }
  })
  if (failed.length) {
    throw new Error(failed.join('\n'))
  }
}

/** upload multi files */
async function uploadFiles (ssh: SSH, pairs: IFilePairs) {
  await ssh.putFiles(pairs)
}

function getFilePairs (srcFiles: string[], cmd: IUploadConfig): IFilePairs {
  if (srcFiles.length === 1) {
    const src = srcFiles[0]
    let dest = cmd.dest
    if (cmd.srcPrefix) {
      dest = path.join(dest, src.replace(cmd.srcPrefix, ''))
    }
    return [{ local: src, remote: dest }]
  }
  if (!cmd.srcPrefix) {
    throw new TypeError('`srcPrefix` must be sepicifed when upload multi files through `src` pattern')
  }
  const prefix = cmd.srcPrefix
  return srcFiles.map(f => {
    return {
      local: f,
      remote: path.join(cmd.dest, f.replace(prefix, ''))
    }
  })
}


/** get match file with the file pattern */
function getLocalFile (pattern: string, suppressErr: boolean) {
  return new Promise<string[]>((resolve, reject) => {
    glob(path.join(pattern), (err, files) => {
      if (err) return suppressErr ? resolve() : reject(err)
      if (!files.length) {
        return suppressErr
          ? resolve()
          : reject(new Error(`no ${pattern} file found`))
      }
      resolve(files)
    })
  })
}
