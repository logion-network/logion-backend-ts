import { injectable } from 'inversify';
import { importFile } from '../lib/db/large_objects';

@injectable()
export class FileImportService {

    async importFile(path: string, comment: string) {
        return await importFile(path, comment);
    }
}
