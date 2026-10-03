import deploy from './ssh/index.js'
import { runShellCmd, findFileRecursive, addGitTag } from './utils.js'

export { deploy, runShellCmd, findFileRecursive, addGitTag }

export * from './ssh/index.js'

// Native ESM default imports of the old CommonJS package received this API object.
export default { deploy, runShellCmd, findFileRecursive, addGitTag }
