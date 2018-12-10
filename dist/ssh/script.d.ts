import SSH from 'node-ssh';
export interface IScriptConfig {
    type: 'script';
    shell?: string;
    shebang?: string;
    script: string;
    cwd: string;
    /** allow failure, so the command sequence will continue to run even this failed */
    allowFailure?: boolean;
}
/** exec remote command */
export declare function runScript(ssh: SSH, config: IScriptConfig, showLog?: boolean): Promise<void>;
