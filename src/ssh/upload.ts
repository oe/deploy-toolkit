import path from 'path'
import { glob } from 'glob'
import fs from 'fs'
import { type NodeSSH as SSH } from 'node-ssh'

/** upload config */
export interface IUploadConfig {
  type: 'upload'
  /** source file(in local), could be a specified file/directory path or a glob pattern */
  src: string
  /** if src is a glob pattern, then srcPrefix is need, to determine the path save on server. omit it if src is a spicifed file/directory path */
  srcPrefix?: string
  /** destination path(on server), should be a file path if src is a specified file, or a directory for other situations */
  dest: string
  /** allow failure, so the command sequence will continue to run even this failed */
  allowFailure?: boolean
}

interface IFilePair {
  /** file in local path */
  local: string
  /** file in remote(server) path */
  remote: string
}

type IFilePairs = IFilePair[]


/** upload files and directory */
export async function upload (ssh: SSH, cmd: IUploadConfig, showLog?: boolean) {
  const srcfiles = await getLocalFile(cmd.src)
  if (showLog) {
    console.log('[deploy][upload]upload file with config: \n', JSON.stringify(cmd, null, 2))
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
    console.log('[deploy][upload] try to upload files: \n', JSON.stringify(filePairs, null, 2))
  }
  await uploadFiles(ssh, filePairs)
}

/** upload folder */
async function uploadDir (ssh: SSH, srcDir: string, destDir: string) {
  const failed: string[] = []
  const success = await ssh.putDirectory(srcDir, destDir, {
    recursive: true,
    tick: function (localPath, remotePath, error) {
      if (error) {
        failed.push(`[error]failed to push ${localPath} to ${remotePath}, because of ${error.message}`)
      }
    }
  })
  if (!success || failed.length) {
    throw new Error(failed.join('\n') || `Failed to upload directory ${srcDir}`)
  }
}


/** upload multi files */
export async function uploadFiles (ssh: SSH, pairs: IFilePairs) {
  await ssh.putFiles(pairs)
}

function getFilePairs (srcFiles: string[], cmd: IUploadConfig): IFilePairs {
  if (srcFiles.length === 1 && !cmd.srcPrefix) {
    return [{ local: srcFiles[0], remote: cmd.dest }]
  }
  if (!cmd.srcPrefix) {
    throw new TypeError('`srcPrefix` must be specified when uploading multiple files')
  }
  const prefix = path.resolve(cmd.srcPrefix)
  return srcFiles.map(local => {
    const relative = path.relative(prefix, local)
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`Upload source ${local} is outside srcPrefix ${cmd.srcPrefix}`)
    }
    if (!fs.statSync(local).isFile()) throw new Error(`Upload pattern matched a directory: ${local}`)
    return {
      local,
      remote: path.posix.join(cmd.dest, relative.split(path.sep).join('/'))
    }
  })
}

/** Match literal paths first so file names containing glob syntax remain usable. */
async function getLocalFile (pattern: string): Promise<string[]> {
  if (fs.existsSync(pattern)) return [path.resolve(pattern)]
  const files = await glob(pattern, { absolute: true, nodir: true })
  if (!files.length) throw new Error(`No files found for ${pattern}`)
  return files.sort()
}
