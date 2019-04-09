import SSH from 'node-ssh'
import { join } from 'path'

export default async function exec (ssh: SSH, cmd: string, args?: string[], options?: object) {
  // @ts-ignore
  if (options && /^\s*~/.test(options.cwd)) {
    const cwd = await ssh.exec('echo ~')
    // @ts-ignore
    options.cwd = join(cwd, options.cwd.replace(/^\s*~\/?/, ''))
  }
  const result = await ssh.exec(cmd, args, options)
  return result
}