import SSH from 'node-ssh'
/** download config */
export interface IDownloadConfig {
  type: 'download'
  /** source file path(on server) */
  src: string
  /** dest save path(in local) */
  dest: string
  /** allow failure, so the command sequence will continue to run even this failed */
  allowFailure?: boolean
}

/** download a single file */
export async function download (ssh: SSH, cmd: IDownloadConfig, showLog?: boolean) {
  if (showLog) {
    console.log('[deploy][download]download file with config: \n', JSON.stringify(cmd, null, 2))
  }
  await ssh.getFile(cmd.dest, cmd.src)
}
