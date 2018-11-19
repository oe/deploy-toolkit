"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = deploy;

var _nodeSsh = _interopRequireDefault(require("node-ssh"));

var _glob = _interopRequireDefault(require("glob"));

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// 自动上传安装包到测试服务器

/** entrance */
async function deploy(deployCmd) {
  let ssh;

  try {
    const showLog = !!deployCmd.log;
    ssh = await getSshClient(deployCmd.ssh, showLog);
    const cmds = deployCmd.cmds;

    for (let index = 0; index < cmds.length; index++) {
      const cmd = cmds[index];

      switch (cmd.type) {
        case 'cmd':
          await runSSHCmd(ssh, cmd, showLog);
          break;

        case 'upload':
          await upload(ssh, cmd, showLog);
          break;

        case 'download':
          await download(ssh, cmd, showLog);
          break;

        default:
          throw new TypeError(`unsupported cmd ${JSON.stringify(cmd)}`);
      }
    } // close connection


    ssh.dispose();
  } catch (error) {
    // close connection even error occured 
    if (ssh && ssh.dispose) {
      ssh.dispose();
    }

    throw error;
  }
}
/** get SSH object */


async function getSshClient(config, showLog) {
  const ssh = new _nodeSsh.default();

  if (showLog) {
    console.log(`[deploy][connnect] connect to \`${config.host}\` as user \`${config.username}\``);
  }

  await ssh.connect(config);
  return ssh;
}
/** exec remote command */


async function runSSHCmd(ssh, cmd, showLog) {
  const options = cmd.options || {
    stream: 'stdout'
  };
  if (cmd.cwd) options.cwd = cmd.cwd;

  if (showLog) {
    console.log('[deploy][cmd] `', cmd.args.join(' '), '` with cwd', cmd.cwd);
  }

  const result = await ssh.exec(cmd.args.shift(), cmd.args, options);

  if (showLog) {
    console.log('[deploy][cmd] command result:');
    console.log(result);
  }
}
/** upload files and directory */


async function upload(ssh, cmd, showLog) {
  const srcfiles = await getLocalFile(cmd.src, false);

  if (showLog) {
    console.log('[deploy][upload]upload file with config', cmd);
  }

  if (!srcfiles.length) {
    if (showLog) {
      console.warn('[deploy][upload][warn]can not find any file to upload with config', cmd);
    }

    return;
  }

  if (srcfiles.length === 1 && _fs.default.statSync(srcfiles[0]).isDirectory()) {
    const src = srcfiles[0];

    if (showLog) {
      console.log(`[deploy][upload] try to upload dir from \`${src}\` to \`${cmd.dest}\``);
    }

    await uploadDir(ssh, src, cmd.dest);
    return;
  }

  const filePairs = getFilePairs(srcfiles, cmd);

  if (showLog) {
    console.log('[deploy][upload] try to upload files', filePairs);
  }

  await uploadFiles(ssh, filePairs);
}
/** download a single file */


async function download(ssh, cmd, showLog) {
  if (showLog) {
    console.log('[deploy][download]download file with config', cmd);
  }

  await ssh.getFile(cmd.dest, cmd.src);
}
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

function getFilePairs(srcFiles, cmd) {
  if (srcFiles.length === 1) {
    const src = srcFiles[0];
    let dest = cmd.dest;

    if (cmd.srcPrefix) {
      dest = _path.default.join(dest, src.replace(cmd.srcPrefix, ''));
    }

    return [{
      local: src,
      remote: dest
    }];
  }

  if (!cmd.srcPrefix) {
    throw new TypeError('`srcPrefix` must be sepicifed when upload multi files through `src` pattern');
  }

  const prefix = cmd.srcPrefix;
  return srcFiles.map(f => {
    return {
      local: f,
      remote: _path.default.join(cmd.dest, f.replace(prefix, ''))
    };
  });
}
/** get match file with the file pattern */


function getLocalFile(pattern, suppressErr) {
  return new Promise((resolve, reject) => {
    (0, _glob.default)(_path.default.join(pattern), (err, files) => {
      if (err) return suppressErr ? resolve() : reject(err);

      if (!files.length) {
        return suppressErr ? resolve() : reject(new Error(`no ${pattern} file found`));
      }

      resolve(files);
    });
  });
}