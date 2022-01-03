import { NodeSSH } from 'node-ssh'
import { join } from 'path'

export default async function exec (ssh: NodeSSH, cmd: string, args?: string[], options?: Record<string, unknown>) {

  if (options && /^\s*~/.test(options.cwd as string)) {
    const cwd = await ssh.exec('echo', ['~'])
    options.cwd = join(cwd, (options.cwd as string).replace(/^\s*~\/?/, ''))
  }
  const result = await ssh.exec(cmd, args || [], options)
  return result
}