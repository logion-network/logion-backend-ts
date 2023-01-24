import { rm, open } from "fs/promises";
import { Shell } from "../Shell.js";
import { create } from 'ipfs-client'

const MAX_DOWNLOAD_BUFFER_SIZE = 4096 * 1024; // bytes

export abstract class FileManager {

    abstract deleteFile(file: string): Promise<void>;

    abstract moveToIpfs(file: string): Promise<string>;

    abstract removeFileFromIpfs(cid: string): Promise<void>;

    abstract downloadFromIpfs(cid: string, file: string): Promise<void>;
}

export interface DefaultFileManagerConfiguration {
    shell: Shell;
    ipfsClusterCtl: string;
    ipfsClusterHost: string;
    minReplica: number;
    maxReplica: number;
    ipfsHost: string;
}

export class DefaultFileManager extends FileManager {

    constructor(configuration: DefaultFileManagerConfiguration) {
        super();
        this.configuration = configuration;
        this.ipfs = create({ http: this.configuration.ipfsHost })
    }

    private readonly configuration: DefaultFileManagerConfiguration;
    private readonly ipfs: any;

    async deleteFile(file: string): Promise<void> {
        await rm(file);
    }

    async moveToIpfs(file: string): Promise<string> {
        const addCommand = `${this.configuration.ipfsClusterCtl} --host ${this.configuration.ipfsClusterHost} add --rmin ${this.configuration.minReplica} --rmax ${this.configuration.maxReplica} --local '${file}'`;
        const { stdout } = await this.configuration.shell.exec(addCommand);
        await this.deleteFile(file);
        const output = stdout.split(" ");
        return output[1];
    }

    async removeFileFromIpfs(cid: string): Promise<void> {
        const removeCommand = `${this.configuration.ipfsClusterCtl} --host ${this.configuration.ipfsClusterHost} pin rm ${cid}`;
        await this.configuration.shell.exec(removeCommand);
    }

    async downloadFromIpfs(cid: string, file: string): Promise<void> {
        const fd = await open(file, 'w');
        let offset = 0;
        let endOfFile = false;
        while(!endOfFile) {
            const buffer: AsyncIterable<Uint8Array> = this.ipfs.cat(cid, { offset, length: MAX_DOWNLOAD_BUFFER_SIZE });
            let bufferLength = 0;
            for await (const chunk of buffer) {
                bufferLength += chunk.length;
                await fd.write(chunk);
            }
            offset += MAX_DOWNLOAD_BUFFER_SIZE;
            endOfFile = (bufferLength < MAX_DOWNLOAD_BUFFER_SIZE);
        }
        await fd.close();
    }
}
