"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = __importDefault(require("child_process"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function runShellCmd(cmd, args, options) {
    if (!Array.isArray(args)) {
        options = args;
        args = [];
    }
    const task = child_process_1.default.spawn(cmd, 
    // @ts-ignore
    args, Object.assign({
        cwd: process.cwd(),
        shell: true
    }, options));
    return new Promise((resolve, reject) => {
        // record response content
        const output = [];
        task.stdout.on('data', data => {
            output.push(data);
        });
        task.stderr.on('data', data => {
            output.push(data);
        });
        // listen on error, to aviod command crash
        task.on('error', () => {
            reject(output);
        });
        task.on('exit', code => {
            if (code) {
                output.unshift(`error code: ${code}\n`);
                reject(output.join('').toString());
            }
            else {
                resolve(output.join('').toString());
            }
        });
    });
}
exports.runShellCmd = runShellCmd;
/**
 * find a file(dir) recursive( aka try to find package.json, node_modules, etc.)
 * @param fileName file name(or dir name if isDir is true)
 * @param dir the initial dir path to find, use `process.cwd()` by default
 * @param isDir whether to find a dir
 */
function findFileRecursive(fileName, dir = process.cwd(), isDir = false) {
    const filepath = path_1.default.join(dir, fileName);
    try {
        const stat = fs_1.default.statSync(filepath);
        const isFound = isDir ? stat.isDirectory() : stat.isFile();
        if (isFound)
            return filepath;
    }
    catch (e) {
        // xxx
    }
    // has reach the top root
    const parentDir = path_1.default.dirname(dir);
    if (parentDir === dir)
        return '';
    return findFileRecursive(fileName, parentDir, isDir);
}
exports.findFileRecursive = findFileRecursive;
/** add tag for git, use `v${package.version}` in package.json as tagName by default  */
async function addGitTag(tagName) {
    const options = {
        cwd: process.cwd()
    };
    if (!tagName) {
        const pkgPath = findFileRecursive('package.json');
        if (!pkgPath)
            throw new Error('can not find `package.json` to determine the tagName');
        const pkg = require(pkgPath);
        tagName = `v${pkg.version}`;
        // change cwd to package.json's dirname, to avoid use a package.json version string out of a git repo
        options.cwd = path_1.default.dirname(pkgPath);
    }
    await runShellCmd('git', ['tag', `${tagName}`], options);
    await runShellCmd('git', ['push', 'origin', `${tagName}`], options);
    return tagName;
}
exports.addGitTag = addGitTag;
