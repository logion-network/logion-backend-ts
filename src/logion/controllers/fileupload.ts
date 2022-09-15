import { UploadedFile, FileArray } from "express-fileupload";
import { badRequest } from "@logion/rest-api-core";

export function getUploadedFile(request: Express.Request): UploadedFile {
    const files: FileArray | undefined = request.files;
    if(files === undefined || files === null) {
        throw badRequest("No file detected");
    }
    const uploadedFiles: UploadedFile | UploadedFile[] = files['file'];
    let file: UploadedFile;
    if(uploadedFiles instanceof Array) {
        file = uploadedFiles[0];
    } else {
        file = uploadedFiles;
    }
    return file;
}
