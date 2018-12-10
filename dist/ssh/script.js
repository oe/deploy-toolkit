"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const upload_1 = require("./upload");
const download_1 = require("./download");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
function getShebang(config) {
    const text = config.script.trim();
    if (/^#!/.test(text))
        return text;
    let shebang = '#!/usr/bin/env bash';
    if (config.shebang) {
        if (!/^#!/.test(config.shebang))
            throw new TypeError(`unrecognized shebang ${config.shebang}`);
        shebang = config.shebang;
    }
    else if (config.shell) {
        shebang = `#!/usr/bin/env ${config.shell}`;
    }
    return shebang;
}
function normalizeScript(script, shebang, cwd, needPwd) {
    const result = script.trim().split('\n');
    if (!/^#!/.test(result[0])) {
        result.unshift(shebang);
    }
    result.splice(1, 0, `cd "${cwd}"`);
    if (needPwd) {
        result.push('pwd');
    }
    return result.join('\n');
}
function getLastPwd(result) {
    return result.split('\n').pop();
}
async function getTempfile(ssh) {
    const result = await ssh.exec('mktemp');
    return result;
}
async function chmodX(ssh, p) {
    const result = await ssh.exec('chmod', ['+x', p]);
    return result;
}
function analyzeScript(script) {
    return script.trim().split('\n').reduce((acc, cur) => {
        if (/^DOWNLOAD/.test(cur)) {
            acc.push({
                type: 'download',
                code: cur
            });
        }
        else if (/^UPLOAD/.test(cur)) {
            acc.push({
                type: 'upload',
                code: cur
            });
        }
        else {
            const last = acc[acc.length - 1];
            if (last && last.type === 'cmd') {
                last.codes.push(cur);
            }
            else {
                const cmd = {
                    type: 'cmd',
                    codes: [cur]
                };
                acc.push(cmd);
            }
        }
        return acc;
    }, []);
}
function getParams(str) {
    const result = [];
    str = str.trim();
    let last = '';
    let sep;
    for (let index = 0; index < str.length; index++) {
        const element = str[index];
        if (!last) {
            if (/\s/.test(element))
                continue;
            sep = /"|'/.test(element) ? RegExp(element) : /\s/;
            last = ' ';
        }
        else {
            if (sep.test(element)) {
                if (last === ' ')
                    continue;
                result.push(last);
                last = '';
            }
            else {
                last += element;
            }
        }
    }
    return result.map(l => l.replace(/^ /, ''));
}
async function cmdUpload(ssh, code, showLog) {
    const args = getParams(code);
    if (args.length <= 3)
        throw new Error('invalid download config:' + code);
    const src = args[1].split(':');
    const cmd = {
        type: 'upload',
        src: src[0],
        srcPrefix: src[1],
        dest: args[2]
    };
    await upload_1.upload(ssh, cmd, showLog);
}
async function cmdDownload(ssh, code, showLog) {
    const args = getParams(code);
    if (args.length <= 3)
        throw new Error('invalid download config:' + code);
    const cmd = {
        type: 'download',
        src: args[1],
        dest: args[2]
    };
    await download_1.download(ssh, cmd, showLog);
}
async function runCmd(ssh, code, shebang, lastCwd, needPwd) {
    const remote = await getTempfile(ssh);
    const script = normalizeScript(code, shebang, lastCwd, needPwd);
    const dir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'dt-'));
    console.log('sh dir', dir, remote);
    const src = path_1.default.join(dir, 'script');
    fs_1.default.writeFileSync(src, script, 'utf8');
    await upload_1.uploadFiles(ssh, [{ local: src, remote }]);
    await chmodX(ssh, remote);
    const result = await ssh.exec(remote);
    return result;
}
/** exec remote command */
async function runScript(ssh, config, showLog) {
    const shebang = getShebang(config);
    const cmds = analyzeScript(config.script);
    let lastCwd = config.cwd;
    for (let index = 0; index < cmds.length; index++) {
        const cmd = cmds[index];
        if (cmd.type === 'download')
            await cmdDownload(ssh, cmd.code, showLog);
        else if (cmd.type === 'upload')
            await cmdUpload(ssh, cmd.code, showLog);
        else if (cmd.type === 'cmd') {
            const result = await runCmd(ssh, cmd.codes.join('\n'), shebang, lastCwd, true);
            if (showLog) {
                console.log(result);
            }
            lastCwd = getLastPwd(result);
        }
    }
}
exports.runScript = runScript;
