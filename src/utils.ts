import child_process, { SpawnOptions } from 'child_process'
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
export function runShellCmd (cmd: string, args?: string[] | Object, options?: SpawnOptions) {
  if (!Array.isArray(args)) {
    options = args
    args = []
  }
  const task = child_process.spawn(
    cmd,
    // @ts-ignore
    args,
    Object.assign(
      {
        cwd: process.cwd(),
        shell: true
      },
      options
    )
  )

  return new Promise<string>((resolve, reject) => {
    // record response content
    const output: (string | Buffer)[] = []
    task.stdout.on('data', data => {
      output.push(data)
    })
    task.stderr.on('data', data => {
      output.push(data)
    })

    // listen on error, to aviod command crash
    task.on('error', () => {
      reject(output)
    })

    task.on('exit', code => {
      if (code) {
        output.unshift(`error code: ${code}\n`)
        reject(output.join('').toString())
      } else {
        resolve(output.join('').toString())
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
export function findFileRecursive (fileName: string | string[], dir = process.cwd(), isDir = false): string {
  // const filepath = path.join(dir, fileName)
  const fileNames = Array.isArray(fileName) ? fileName : [fileName]
  let f: string | undefined = ''
  // tslint:disable-next-line:no-conditional-assignment
  while ((f = fileNames.shift())) {
    const filepath = path.join(dir, f)
    try {
      const stat = fs.statSync(filepath)
      const isFound = isDir ? stat.isDirectory() : stat.isFile()
      if (isFound) return filepath
    } catch (e) {
      // xxx
    }
  }
  // has reach the top root
  const parentDir = path.dirname(dir)
  if (parentDir === dir) return ''
  return findFileRecursive(fileName, parentDir, isDir)
}

/** add tag for git, use `v${package.version}` in package.json as tagName by default  */
export async function addGitTag (tagName?: string) {
  const options = {
    cwd: process.cwd()
  }
  if (!tagName) {
    const pkgPath = findFileRecursive('package.json')
    if (!pkgPath) throw new Error('can not find `package.json` to determine the tagName')
    const pkg = require(pkgPath)
    tagName = `v${pkg.version}`
    // change cwd to package.json's dirname, to avoid use a package.json version string out of a git repo
    options.cwd = path.dirname(pkgPath)
  }
  await runShellCmd('git', ['tag', `${tagName}`], options)
  await runShellCmd('git', ['push', 'origin', `${tagName}`], options)
  return tagName
}