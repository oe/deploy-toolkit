/// <reference types="node" />
/** upload config */
export interface IUploadConfig {
    type: 'upload';
    /** source file(in local), could be a specified file path, directory path or a glob pattern */
    src: string;
    /** if src is a glob pattern, then srcPrefix is need, to determine the path save on server */
    srcPrefix?: string;
    /** destination path(on server), should be a file path if src is a specified file, or a directory for other situations */
    dest: string;
    /** allow failure, so the command sequence will continue to run even this failed */
    allowFailure?: boolean;
}
/** download config */
export interface IDownloadConfig {
    type: 'download';
    /** source file path(on server) */
    src: string;
    /** dest save path(in local) */
    dest: string;
    /** allow failure, so the command sequence will continue to run even this failed */
    allowFailure?: boolean;
}
/** custom command */
export interface IRunConfig {
    type: 'cmd';
    /** cmd arguments */
    args: string[];
    /** cmd work directory */
    cwd?: string;
    /** options */
    options?: {
        /** another way to set work directory, will be rewrite if set outside */
        cwd?: string;
        /** extra options for ssh2.exec */
        options?: Object;
        /** input for the command */
        stdin?: string;
        /** output */
        stream?: 'stdout' | 'stderr' | 'both';
        /** stdout event */
        onStdout?: ((chunk: Buffer) => void);
        /** stderror event */
        onStderr?: ((chunk: Buffer) => void);
    };
    /** allow failure, so the command sequence will continue to run even this failed */
    allowFailure?: boolean;
}
/** command */
export declare type ICmd = IUploadConfig | IDownloadConfig | IRunConfig;
/** commands sequence */
export declare type ICmds = ICmd[];
/** SSH Connection config */
export interface ISshConfig {
    /** Hostname or IP address of the server. */
    host: string;
    /** Port number of the server. */
    port?: number;
    /** Username for authentication. */
    username?: string;
    /** Password for password-based user authentication. */
    password?: string;
    /** file path of the private key, or the private key text content */
    privateKey?: string;
    /** For an encrypted private key, this is the passphrase used to decrypt it. */
    passphrase?: string;
    /** any other options from ssh2 ConnectConfig */
    [k: string]: any;
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
