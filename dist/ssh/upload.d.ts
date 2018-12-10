import SSH from 'node-ssh';
/** upload config */
export interface IUploadConfig {
    type: 'upload';
    /** source file(in local), could be a specified file/directory path or a glob pattern */
    src: string;
    /** if src is a glob pattern, then srcPrefix is need, to determine the path save on server. omit it if src is a spicifed file/directory path */
    srcPrefix?: string;
    /** destination path(on server), should be a file path if src is a specified file, or a directory for other situations */
    dest: string;
    /** allow failure, so the command sequence will continue to run even this failed */
    allowFailure?: boolean;
}
interface IFilePair {
    /** file in local path */
    local: string;
    /** file in remote(server) path */
    remote: string;
}
declare type IFilePairs = IFilePair[];
/** upload files and directory */
export declare function upload(ssh: SSH, cmd: IUploadConfig, showLog?: boolean): Promise<void>;
/** upload multi files */
export declare function uploadFiles(ssh: SSH, pairs: IFilePairs): Promise<void>;
export {};
