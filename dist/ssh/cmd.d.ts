/// <reference types="node" />
import SSH from 'node-ssh';
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
/** exec remote command */
export declare function runSSHCmd(ssh: SSH, cmd: IRunConfig, showLog: boolean): Promise<void>;
