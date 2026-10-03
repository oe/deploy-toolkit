import { NodeSSH as SSH, type Config } from 'node-ssh'
import os from 'os'

import { upload, type IUploadConfig } from './upload.js'
import { download, type IDownloadConfig } from './download.js'
import { runSSHCmd, type IRunConfig } from './cmd.js'
import { runScript, type IScriptConfig } from './script.js'

export type {
  IUploadConfig,
  IDownloadConfig,
  IRunConfig,
  IScriptConfig
}

/** command */
export type ICmd = IUploadConfig | IDownloadConfig | IRunConfig | IScriptConfig
/** commands sequence */
export type ICmds = readonly ICmd[]

/** SSH Connection config */
export interface ISshConfig extends Config {
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
  const ssh = new SSH()
  try {
    const showLog = !!deployCmd.log
    await connectSshClient(ssh, deployCmd.ssh, showLog)
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
  } finally {
    ssh.dispose()
  }
}

/** get SSH object */
async function connectSshClient (ssh: SSH, givenConfig: ISshConfig, showLog: boolean) {
  const config = { ...givenConfig }
  if (showLog) {
    console.log(`[deploy][connnect] connect to \`${config.host}\` as user \`${config.username}\``)
  }
  // Preserve the legacy API where privateKey accepts a file path or PEM text.
  if (config.privateKey && !config.privateKey.includes('BEGIN')) {
    if (config.privateKeyPath) throw new TypeError('Specify only one of privateKey and privateKeyPath')
    config.privateKeyPath = config.privateKey
    delete config.privateKey
  }
  if (config.privateKeyPath) {
    config.privateKeyPath = config.privateKeyPath.replace(/^~(?=\/|$)/, os.homedir())
  }
  await ssh.connect(config)
}
