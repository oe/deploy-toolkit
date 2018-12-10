import path from 'path'
import glob from 'glob'
import fs from 'fs'
import SSH from 'node-ssh'

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
  const srcfiles = await getLocalFile(cmd.src, false)
  if (showLog) {
    console.log('[deploy][upload]upload file with config: \n', JSON.stringify(cmd, null, 2))
  }
  if (!srcfiles.length) {
    if (showLog) {
      console.warn('[deploy][upload][warn]can not find any file to upload with config:\n ', JSON.stringify(cmd, null, 2))
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
    console.log('[deploy][upload] try to upload files: \n', JSON.stringify(filePairs, null, 2))
  }
  await uploadFiles(ssh, filePairs)
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
export async function uploadFiles (ssh: SSH, pairs: IFilePairs) {
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
