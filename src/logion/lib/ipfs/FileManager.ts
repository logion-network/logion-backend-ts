import { rm, writeFile } from "fs/promises";
import { Shell } from "../Shell";
import { create } from 'ipfs-client'

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
        // todo re-enable as soon as better solution is available, see https://github.com/logion-network/logion-internal/issues/645
        // const removeCommand = `${this.configuration.ipfsClusterCtl} --host ${this.configuration.ipfsClusterHost} pin rm ${cid}`;
        // await this.configuration.shell.exec(removeCommand);
        return Promise.resolve();
    }

    async downloadFromIpfs(cid: string, file: string): Promise<void> {
        const buffer: AsyncIterable<Uint8Array> = this.ipfs.cat(cid)
        return writeFile(file, buffer)
    }
}
