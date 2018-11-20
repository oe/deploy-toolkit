/// <reference types="node" />
import { SpawnOptions } from 'child_process';
/**
 * run local shell command with spawn
 *  resolve with command exec outputs if cmd return 0, or reject with error message
 * @param  {String} cmd     cmd name
 * @param  {Array<String>} args    args list
 * @param  {Object} options spawn cmd options, cwd is vital
 */
export declare function runShellCmd(cmd: string, options?: SpawnOptions): Promise<string>;
export declare function runShellCmd(cmd: string, args?: string[], options?: SpawnOptions): Promise<string>;
/**
 * find a file(dir) recursive( aka try to find package.json, node_modules, etc.)
 * @param fileName file name(or dir name if isDir is true)
 * @param dir the initial dir path to find, use `process.cwd()` by default
 * @param isDir whether to find a dir
 */
export declare function findFileRecursive(fileName: string, dir?: string, isDir?: boolean): string;
/** add tag for git, use `v${package.version}` in package.json as tagName by default  */
export declare function addGitTag(tagName?: string): Promise<string>;
