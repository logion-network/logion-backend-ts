import { injectable } from 'inversify';
import { exportFile, deleteFile } from '../lib/db/large_objects';
import { FileManager, DefaultFileManager, DefaultFileManagerConfiguration } from "../lib/ipfs/FileManager";
import { DefaultShell } from "../lib/Shell";

@injectable()
export class FileDbService {

    constructor() {
        const fileManagerConfiguration: DefaultFileManagerConfiguration = {
            shell: new DefaultShell(),
            ipfsClusterCtl: process.env.IPFS_CLUSTER_CTL!,
            ipfsClusterHost: process.env.IPFS_CLUSTER_HOST!,
            minReplica: Number(process.env.IPFS_MIN_REPLICA!),
            maxReplica: Number(process.env.IPFS_MAX_REPLICA!),
            ipfs: process.env.IPFS!,
            ipfsHost: process.env.IPFS_HOST!,
        };
        this.fileManager = new DefaultFileManager(fileManagerConfiguration)
    }

    async importFile(path: string): Promise<string> {
        return this.fileManager.moveToIpfs(path)
    }

    async exportFile(oid: number, path: string) {
        return await exportFile(oid, path);
    }

    async deleteFile(oid: number) {
        return await deleteFile(oid);
    }

    private readonly fileManager: FileManager;
}
