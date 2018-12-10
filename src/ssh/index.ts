// 自动上传安装包到测试服务器
import SSH from 'node-ssh'
import os from 'os'

import { upload, IUploadConfig } from './upload'
import { download, IDownloadConfig } from './download'
import { runSSHCmd, IRunConfig } from './cmd'
import { runScript, IScriptConfig } from './script'

export {
  IUploadConfig,
  IDownloadConfig,
  IRunConfig,
  IScriptConfig
}

/** command */
export type ICmd = IUploadConfig | IDownloadConfig | IRunConfig | IScriptConfig
/** commands sequence */
export type ICmds = ICmd[]

/** SSH Connection config */
export interface ISshConfig {
  /** Hostname or IP address of the server. */
  host: string
  /** Port number of the server. */
  port?: number
  /** Username for authentication. */
  username?: string
  /** Password for password-based user authentication. */
  password?: string
  /** file path of the private key, or the private key text content */
  privateKey?: string
  /** For an encrypted private key, this is the passphrase used to decrypt it. */
  passphrase?: string
  /** any other options from ssh2 ConnectConfig */
  [k: string]: any
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

/** entrance */
export default async function deploy (deployCmd: IDeployConfig) {
  let ssh: SSH
  try {
    const showLog = !!deployCmd.log
    ssh = await getSshClient(deployCmd.ssh, showLog)
    const cmds = deployCmd.cmds
    for (let index = 0; index < cmds.length; index++) {
      const cmd = cmds[index]
      try {
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
          case 'script':
            await runScript(ssh, cmd, showLog)
            break
          default:
            throw new TypeError(`unsupported cmd ${JSON.stringify(cmd)}`)
        }
      } catch (error) {
        if (cmd.allowFailure) {
          if (showLog) {
            console.warn('[deploy] command failed, but will continue to run:')
            console.warn(error)
          }
          continue
        }
        throw error
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
  // if privateKey is a file path and start with ~
  //    replace ~ with user homedir
  if (config.privateKey &&
    !config.privateKey.includes('BEGIN') &&
    config.privateKey.charAt(0) === '~') {
    config.privateKey = config.privateKey.replace('~', os.homedir())
  }
  await ssh.connect(config)
  return ssh
}










