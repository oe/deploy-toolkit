"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 自动上传安装包到测试服务器
const node_ssh_1 = __importDefault(require("node-ssh"));
const os_1 = __importDefault(require("os"));
const upload_1 = require("./upload");
const download_1 = require("./download");
const cmd_1 = require("./cmd");
const script_1 = require("./script");
/** entrance */
async function deploy(deployCmd) {
    let ssh;
    try {
        const showLog = !!deployCmd.log;
        ssh = await getSshClient(deployCmd.ssh, showLog);
        const cmds = deployCmd.cmds;
        for (let index = 0; index < cmds.length; index++) {
            const cmd = cmds[index];
            try {
                switch (cmd.type) {
                    case 'cmd':
                        await cmd_1.runSSHCmd(ssh, cmd, showLog);
                        break;
                    case 'upload':
                        await upload_1.upload(ssh, cmd, showLog);
                        break;
                    case 'download':
                        await download_1.download(ssh, cmd, showLog);
                        break;
                    case 'script':
                        await script_1.runScript(ssh, cmd, showLog);
                        break;
                    default:
                        throw new TypeError(`unsupported cmd ${JSON.stringify(cmd)}`);
                }
            }
            catch (error) {
                if (cmd.allowFailure) {
                    if (showLog) {
                        console.warn('[deploy] command failed, but will continue to run:');
                        console.warn(error);
                    }
                    continue;
                }
                throw error;
            }
        }
        // close connection
        ssh.dispose();
    }
    catch (error) {
        // close connection even error occured 
        if (ssh && ssh.dispose) {
            ssh.dispose();
        }
        throw error;
    }
}
exports.default = deploy;
/** get SSH object */
async function getSshClient(config, showLog) {
    const ssh = new node_ssh_1.default();
    if (showLog) {
        console.log(`[deploy][connnect] connect to \`${config.host}\` as user \`${config.username}\``);
    }
    // if privateKey is a file path and start with ~
    //    replace ~ with user homedir
    if (config.privateKey &&
        !config.privateKey.includes('BEGIN') &&
        config.privateKey.charAt(0) === '~') {
        config.privateKey = config.privateKey.replace('~', os_1.default.homedir());
    }
    await ssh.connect(config);
    return ssh;
}
