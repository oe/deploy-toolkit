/** 上传配置 */
export interface IUploadConfig {
    type: 'upload';
    /** source file(in local), could be a specified file path, directory path or a glob pattern */
    src: string;
    /** if src is a glob pattern, then srcPrefix is need, to determine the path save on server */
    srcPrefix?: string;
    /** destination path(on server), should be a file path if src is a specified file, or a directory for other situations */
    dest: string;
}
/** download config */
export interface IDownloadConfig {
    type: 'download';
    /** source file path(on server) */
    src: string;
    /** dest save path(in local) */
    dest: string;
}
/** custom command */
export interface IRunConfig {
    type: 'cmd';
    /** cmd arguments */
    args: string[];
    /** options */
    options?: any;
    /** cmd work directory */
    cwd?: string;
}
/** command */
export declare type ICmd = IUploadConfig | IDownloadConfig | IRunConfig;
/** commands sequence */
export declare type ICmds = ICmd[];
/** SSH Connection config */
export interface ISshConfig {
    host: string;
    port?: number;
    username: string;
    password?: string;
    passphrase?: string;
    privateKey?: string;
}
/** deploy confgi */
export interface IDeployConfig {
    /** ssh connection config */
    ssh: ISshConfig;
    /** whether to show log when executing cmds */
    log?: boolean;
    /** command sequence */
    cmds: ICmds;
}
/** entrance */
export default function deploy(deployCmd: IDeployConfig): Promise<void>;
