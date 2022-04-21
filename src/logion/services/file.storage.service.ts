import { injectable } from 'inversify';
import { exportFile, deleteFile } from '../lib/db/large_objects';
import { FileManager, DefaultFileManager, DefaultFileManagerConfiguration } from "../lib/ipfs/FileManager";
import { DefaultShell } from "../lib/Shell";

export interface FileId {
    oid?: number
    cid?: string
}

@injectable()
export class FileStorageService {

    constructor() {
        const fileManagerConfiguration: DefaultFileManagerConfiguration = {
            shell: new DefaultShell(),
            ipfsClusterCtl: process.env.IPFS_CLUSTER_CTL!,
            ipfsClusterHost: process.env.IPFS_CLUSTER_HOST!,
            minReplica: Number(process.env.IPFS_MIN_REPLICA!),
            maxReplica: Number(process.env.IPFS_MAX_REPLICA!),
            ipfsHost: process.env.IPFS_HOST!,
        };
        this.fileManager = new DefaultFileManager(fileManagerConfiguration)
    }

    async importFile(path: string): Promise<string> {
        return this.fileManager.moveToIpfs(path)
    }

    async exportFile(id: FileId, path: string): Promise<void> {
        if (id.oid) {
            return await exportFile(id.oid, path);
        }
        if (id.cid) {
            return await this.fileManager.downloadFromIpfs(id.cid, path)
        }
        throw new Error("File to download has no id")
    }

    async deleteFile(id: FileId): Promise<void> {
        if (id.oid) {
            return await deleteFile(id.oid);
        }
        if (id.cid) {
            return await this.fileManager.removeFileFromIpfs(id.cid)
        }
        throw new Error("File to delete has no id")
    }

    private readonly fileManager: FileManager;
}
