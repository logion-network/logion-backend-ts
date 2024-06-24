import { injectable } from 'inversify';
import { exportFile, deleteFile, importFile } from '../lib/db/large_objects.js';
import { FileManager, DefaultFileManager, DefaultFileManagerConfiguration } from "../lib/ipfs/FileManager.js";
import { DefaultShell } from "../lib/Shell.js";
import { EncryptedFileWriter, EncryptedFileReader } from "../lib/crypto/EncryptedFile.js";
import { ValidAccountId } from "@logion/node-api";
import { DB_SS58_PREFIX } from "../model/supportedaccountid.model.js";
import { requireDefined } from "@logion/rest-api-core";

export interface FileId {
    oid?: number
    cid?: string | null
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
        this.encryptedFileWriter = new EncryptedFileWriter()
        this.encryptedFileReader = new EncryptedFileReader()
    }

    async importFile(path: string, legalOfficer: ValidAccountId): Promise<string> {
        const encrypted = await this.encryptedFileWriter.encrypt({ clearFile: path, password: this.getPassword(legalOfficer) })
        return this.fileManager.moveToIpfs(encrypted)
    }

    async importFileInDB(path: string, comment: string): Promise<number> {
        return await importFile(path, comment);
    }

    async exportFile(id: FileId, path: string, legalOfficer: ValidAccountId): Promise<void> {
        if (id.oid) {
            return await exportFile(id.oid, path);
        } else if (id.cid) {
            const encryptedFile = `${path}.enc`
            await this.fileManager.downloadFromIpfs(id.cid, encryptedFile)
            await this.encryptedFileReader.decrypt({ encryptedFile, clearFile: path, password: this.getPassword(legalOfficer) })
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

    private getPassword(legalOfficer: ValidAccountId): string {
        const propertyName = `ENC_PASSWORD_${ legalOfficer.getAddress(DB_SS58_PREFIX) }`;
        const password = process.env[propertyName];
        return requireDefined(
            password,
            () => new Error(`Cannot encrypt/decrypt file. Property ${ propertyName } not found.`)
        )
    }
}
