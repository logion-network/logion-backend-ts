import { exec, spawn } from 'child_process';
import { Writable } from 'stream';

export interface ShellExecResult {
    stdout: string;
    stderr: string;
}

export abstract class ProcessHandler {

    async onStdOut(data: any) {

    }

    async onStdErr(data: any) {

    }

    async onClose(code: number | null) {

    }

    onStdIn(stdin: Writable) {

    }
}

export abstract class Shell {

    abstract exec(command: string): Promise<ShellExecResult>;

    abstract spawn(command: string, args: string[], handler: ProcessHandler, env?: NodeJS.ProcessEnv | undefined): Promise<void>;
}

export class DefaultShell extends Shell {

    async exec(command: string): Promise<ShellExecResult> {
        return new Promise<ShellExecResult>((resolve, reject) => {
            exec(command, {}, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({
                        stdout,
                        stderr
                    });
                }
            });
        });
    }

    async spawn(command: string, args: string[], handler: ProcessHandler, env?: NodeJS.ProcessEnv | undefined): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let rejected = false;
            const process = spawn(command, args, {
                env
            });
            handler.onStdIn(process.stdin);
            process.stdout.on('data', async data => {
                process.stdout.pause();
                await handler.onStdOut(data);
                process.stdout.resume();
            });
            process.stderr.on('data', async data => {
                process.stderr.pause();
                await handler.onStdErr(data);
                process.stderr.resume();
            });
            process.on('close', async code => {
                await handler.onClose(code);
                if(code !== 0) {
                    if(!rejected) {
                        rejected = true;
                        reject(new Error("Exit code is not zero"));
                    }
                } else {
                    resolve();
                }
            });
            process.on('error', error => {
                if(!rejected) {
                    rejected = true;
                    reject(error);
                }
            });
        });
    }
}
