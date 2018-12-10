"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** download a single file */
async function download(ssh, cmd, showLog) {
    if (showLog) {
        console.log('[deploy][download]download file with config: \n', JSON.stringify(cmd, null, 2));
    }
    await ssh.getFile(cmd.dest, cmd.src);
}
exports.download = download;
