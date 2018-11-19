"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "deploy", {
  enumerable: true,
  get: function () {
    return _ssh.default;
  }
});
Object.defineProperty(exports, "IUploadConfig", {
  enumerable: true,
  get: function () {
    return _ssh.IUploadConfig;
  }
});
Object.defineProperty(exports, "IDownloadConfig", {
  enumerable: true,
  get: function () {
    return _ssh.IDownloadConfig;
  }
});
Object.defineProperty(exports, "IRunConfig", {
  enumerable: true,
  get: function () {
    return _ssh.IRunConfig;
  }
});
Object.defineProperty(exports, "ICmd", {
  enumerable: true,
  get: function () {
    return _ssh.ICmd;
  }
});
Object.defineProperty(exports, "ICmds", {
  enumerable: true,
  get: function () {
    return _ssh.ICmds;
  }
});
Object.defineProperty(exports, "IDeployConfig", {
  enumerable: true,
  get: function () {
    return _ssh.IDeployConfig;
  }
});

var _ssh = _interopRequireWildcard(require("./ssh"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }