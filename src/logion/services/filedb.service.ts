import { injectable } from 'inversify';
import { importFile, exportFile, deleteFile } from '../lib/db/large_objects';

@injectable()
export class FileDbService {

    async importFile(path: string, comment: string) {
        return await importFile(path, comment);
    }

    async exportFile(oid: number, path: string) {
        return await exportFile(oid, path);
    }

    async deleteFile(oid: number) {
        return await deleteFile(oid);
    }
}
