"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** exec remote command */
async function runSSHCmd(ssh, cmd, showLog) {
    const options = cmd.options || { stream: 'stdout' };
    if (cmd.cwd)
        options.cwd = cmd.cwd;
    if (showLog) {
        console.log('[deploy][cmd] run `', cmd.args.join(' '), '` with cwd', cmd.cwd);
    }
    const result = await ssh.exec(cmd.args.shift(), cmd.args, options);
    if (showLog) {
        console.log('[deploy][cmd] command result:');
        console.log(result);
    }
}
exports.runSSHCmd = runSSHCmd;
