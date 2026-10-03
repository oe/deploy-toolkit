import { type NodeSSH as SSH, type SSHExecCommandOptions, type SSHExecCommandResponse } from 'node-ssh'
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
  const result = await ssh.exec(cmd, args, { ...options, stream: 'both' })
  if (result.code !== 0 || result.signal) {
    throw new Error(`Remote command failed (${result.signal || result.code}): ${cmd}\n${result.stderr || result.stdout}`)
  }
  return result
}
