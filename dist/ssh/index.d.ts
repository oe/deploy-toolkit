import { IUploadConfig } from './upload';
import { IDownloadConfig } from './download';
import { IRunConfig } from './cmd';
import { IScriptConfig } from './script';
export { IUploadConfig, IDownloadConfig, IRunConfig, IScriptConfig };
/** command */
export declare type ICmd = IUploadConfig | IDownloadConfig | IRunConfig | IScriptConfig;
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
