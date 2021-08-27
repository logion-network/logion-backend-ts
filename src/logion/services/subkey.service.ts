import { injectable } from 'inversify';
import { exec } from 'child_process';

export interface VerifyParams {
    signature: string;
    address: string;
    message: string;
}

@injectable()
export class SubkeyService {

    verify(params: VerifyParams): Promise<boolean> {
        return new Promise((success, error) => {
            const subkeyCommand = process.env.SUBKEY || "subkey";
            const child = exec(`${subkeyCommand} verify ${params.signature} ${params.address}`);

            child.stdin!.write(Buffer.from(params.message, "utf-8"));
            child.stdin!.end();

            child.on('exit', () => {
                success(child.exitCode === 0);
            });
            child.on('error', () => {
                error();
            });
        });
    }
}
