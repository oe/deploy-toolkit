import type { NodeSSH as SSH, SSHExecCommandOptions } from 'node-ssh'
import sshexec from './sshexec.js'
/** custom command */
export interface IRunConfig {
  type: 'cmd'
  /** cmd arguments */
  args: string[]
  /** cmd work directory */
  cwd?: string
  /** options */
  options?: SSHExecCommandOptions & {
    /** legacy alias for execOptions */
    options?: SSHExecCommandOptions['execOptions']
    /** output selection retained for compatibility */
    stream?: 'stdout' | 'stderr' | 'both'
  }
  /** allow failure, so the command sequence will continue to run even this failed */
  allowFailure?: boolean
}

/** exec remote command */
export async function runSSHCmd (ssh: SSH, cmd: IRunConfig, showLog: boolean) {

  const options = { ...cmd.options }
  if (cmd.cwd) options.cwd = cmd.cwd
  if (showLog) {
    console.log('[deploy][cmd] run `', cmd.args.join(' '), '` with cwd', cmd.cwd)
  }
  const [command, ...args] = cmd.args
  if (!command) throw new TypeError('Command args must include a command name')
  const result = await sshexec(ssh, command, args, options)
  if (showLog) {
    console.log('[deploy][cmd] command result:')
    console.log(result)
  }

}
