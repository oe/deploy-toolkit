import child_process, { type SpawnOptions } from 'child_process'
import fs from 'fs'
import path from 'path'
/**
 * run local shell command with spawn
 *  resolve with command exec outputs if cmd return 0, or reject with error message
 * @param  {String} cmd     cmd name
 * @param  {Array<String>} args    args list
 * @param  {Object} options spawn cmd options, cwd is vital
 */
export function runShellCmd (cmd: string, options?: SpawnOptions): Promise<string>
export function runShellCmd (cmd: string, args?: string[], options?: SpawnOptions): Promise<string>
export function runShellCmd (cmd: string, args?: string[] | SpawnOptions, options?: SpawnOptions) {
  if (!Array.isArray(args)) {
    options = args || options
    args = []
  }
  const task = child_process.spawn(
    cmd,
    args,
    Object.assign(
      {
        cwd: process.cwd(),
        shell: false
      },
      options
    )
  )

  return new Promise<string>((resolve, reject) => {
    // record response content
    const stdout: (string | Buffer)[] = []
    const stderr: (string | Buffer)[] = []
    task.stdout?.on('data', data => {
      stdout.push(data)
    })
    task.stderr?.on('data', data => {
      stderr.push(data)
    })

    // listen on error, to aviod command crash
    task.on('error', reject)

    task.on('close', (code, signal) => {
      if (code !== 0 || signal) {
        reject(new Error(`command failed (${signal || code}): ${stderr.join('')}`))
      } else {
        resolve(stdout.join('').toString())
      }
    })
  })
}

/**
 * find a file(dir) recursive( aka try to find package.json, node_modules, etc.)
 * @param fileName file name(or dir name if isDir is true)
 * @param dir the initial dir path to find, use `process.cwd()` by default
 * @param isDir whether to find a dir
 */
export function findFileRecursive (fileName: string | readonly string[], dir = process.cwd(), isDir = false): string {
  const fileNames = typeof fileName === 'string' ? [fileName] : fileName
  let currentDir = path.resolve(dir)
  while (true) {
    for (const file of fileNames) {
      const filepath = path.join(currentDir, file)
      try {
        const stat = fs.statSync(filepath)
        if (isDir ? stat.isDirectory() : stat.isFile()) return filepath
      } catch {
        // Keep searching ancestors when the candidate is absent or inaccessible.
      }
    }
    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) return ''
    currentDir = parentDir
  }
}

/** add tag for git, use `v${package.version}` in package.json as tagName by default  */
export async function addGitTag (tagName?: string) {
  const options = {
    cwd: process.cwd()
  }
  if (!tagName) {
    const pkgPath = findFileRecursive('package.json')
    if (!pkgPath) throw new Error('can not find `package.json` to determine the tagName')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    tagName = `v${pkg.version}`
    // change cwd to package.json's dirname, to avoid use a package.json version string out of a git repo
    options.cwd = path.dirname(pkgPath)
  }
  await runShellCmd('git', ['check-ref-format', `refs/tags/${tagName}`], options)
  await runShellCmd('git', ['tag', '--', tagName], options)
  await runShellCmd('git', ['push', 'origin', `refs/tags/${tagName}`], options)
  return tagName
}
