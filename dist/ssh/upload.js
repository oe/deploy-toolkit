"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const glob_1 = __importDefault(require("glob"));
const fs_1 = __importDefault(require("fs"));
/** upload files and directory */
async function upload(ssh, cmd, showLog) {
    const srcfiles = await getLocalFile(cmd.src, false);
    if (showLog) {
        console.log('[deploy][upload]upload file with config: \n', JSON.stringify(cmd, null, 2));
    }
    if (!srcfiles.length) {
        if (showLog) {
            console.warn('[deploy][upload][warn]can not find any file to upload with config:\n ', JSON.stringify(cmd, null, 2));
        }
        return;
    }
    if (srcfiles.length === 1 && fs_1.default.statSync(srcfiles[0]).isDirectory()) {
        const src = srcfiles[0];
        if (showLog) {
            console.log(`[deploy][upload] try to upload dir from \`${src}\` to \`${cmd.dest}\``);
        }
        await uploadDir(ssh, src, cmd.dest);
        return;
    }
    const filePairs = getFilePairs(srcfiles, cmd);
    if (showLog) {
        console.log('[deploy][upload] try to upload files: \n', JSON.stringify(filePairs, null, 2));
    }
    await uploadFiles(ssh, filePairs);
}
exports.upload = upload;
/** upload folder */
async function uploadDir(ssh, srcDir, destDir) {
    const failed = [];
    await ssh.putDirectory(srcDir, destDir, {
        recursive: true,
        tick: function (localPath, remotePath, error) {
            if (error) {
                failed.push(`[error]failed to push ${localPath} to ${remotePath}, because of ${error.message}`);
            }
        }
    });
    if (failed.length) {
        throw new Error(failed.join('\n'));
    }
}
/** upload multi files */
async function uploadFiles(ssh, pairs) {
    await ssh.putFiles(pairs);
}
exports.uploadFiles = uploadFiles;
function getFilePairs(srcFiles, cmd) {
    if (srcFiles.length === 1) {
        const src = srcFiles[0];
        let dest = cmd.dest;
        if (cmd.srcPrefix) {
            dest = path_1.default.join(dest, src.replace(cmd.srcPrefix, ''));
        }
        return [{ local: src, remote: dest }];
    }
    if (!cmd.srcPrefix) {
        throw new TypeError('`srcPrefix` must be sepicifed when upload multi files through `src` pattern');
    }
    const prefix = cmd.srcPrefix;
    return srcFiles.map(f => {
        return {
            local: f,
            remote: path_1.default.join(cmd.dest, f.replace(prefix, ''))
        };
    });
}
/** get match file with the file pattern */
function getLocalFile(pattern, suppressErr) {
    return new Promise((resolve, reject) => {
        glob_1.default(path_1.default.join(pattern), (err, files) => {
            if (err)
                return suppressErr ? resolve() : reject(err);
            if (!files.length) {
                return suppressErr
                    ? resolve()
                    : reject(new Error(`no ${pattern} file found`));
            }
            resolve(files);
        });
    });
}
