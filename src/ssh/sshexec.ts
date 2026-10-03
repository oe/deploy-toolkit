import type { NodeSSH as SSH, SSHExecCommandOptions, SSHExecCommandResponse } from 'node-ssh'
import { posix } from 'path'

interface ExecOptions extends SSHExecCommandOptions {
  options?: SSHExecCommandOptions['execOptions']
  stream?: 'stdout' | 'stderr' | 'both'
}

export default async function exec (ssh: SSH, cmd: string, args: string[] = [], givenOptions: ExecOptions = {}): Promise<SSHExecCommandResponse> {
  const { options: legacyOptions, stream, ...options } = givenOptions
  if (legacyOptions && !options.execOptions) options.execOptions = legacyOptions
  if (options.cwd && /^~(?:\/|$)/.test(options.cwd)) {
    const home = await exec(ssh, 'printf "%s" "$HOME"')
    options.cwd = posix.join(home.stdout, options.cwd.slice(1))
  }
  let command = cmd
  if (options.cwd) {
    const cwd = "'" + options.cwd.replace(/'/g, "'\\''") + "'"
    // node-ssh uses `cd ... ; command`, which still runs command if cd fails.
    command = `cd -- ${cwd} && ${cmd}`
    delete options.cwd
  }
  const result = await ssh.exec(command, args, { ...options, stream: 'both' })
  if (result.code !== 0 || result.signal) {
    throw new Error(`Remote command failed (${result.signal || result.code}): ${cmd}\n${result.stderr || result.stdout}`)
  }
  return result
}
