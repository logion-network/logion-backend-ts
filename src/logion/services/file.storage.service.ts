import { injectable } from 'inversify';
import { exportFile, deleteFile } from '../lib/db/large_objects';
import { FileManager, DefaultFileManager, DefaultFileManagerConfiguration } from "../lib/ipfs/FileManager";
import { DefaultShell } from "../lib/Shell";
import { EncryptedFileWriter, EncryptedFileReader } from "../lib/crypto/EncryptedFile";

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
        const password = process.env.ENC_PASSWORD!
        this.encryptedFileWriter = new EncryptedFileWriter(password)
        this.encryptedFileReader = new EncryptedFileReader(password)
    }

    async importFile(path: string): Promise<string> {
        const encrypted = await this.encryptedFileWriter.encrypt({ clearFile: path })
        return this.fileManager.moveToIpfs(encrypted)
    }

    async exportFile(id: FileId, path: string): Promise<void> {
        if (id.oid) {
            return await exportFile(id.oid, path);
        } else if (id.cid) {
            const encryptedFile = `${path}.enc`
            await this.fileManager.downloadFromIpfs(id.cid, encryptedFile)
            await this.encryptedFileReader.decrypt({ encryptedFile, clearFile: path })
        } else {
            throw new Error("File to download has no id")
        }
    }

    async deleteFile(id: FileId): Promise<void> {
        if (id.oid) {
            return await deleteFile(id.oid);
        } else if (id.cid) {
            return await this.fileManager.removeFileFromIpfs(id.cid)
        } else {
            throw new Error("File to delete has no id")
        }
    }

    private readonly fileManager: FileManager;
    private readonly encryptedFileWriter: EncryptedFileWriter;
    private readonly encryptedFileReader: EncryptedFileReader;
}
