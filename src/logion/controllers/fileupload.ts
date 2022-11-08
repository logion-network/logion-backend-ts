import { UploadedFile, FileArray } from "express-fileupload";
import { badRequest } from "@logion/rest-api-core";
import { sha256File } from "../lib/crypto/hashing";

export async function getUploadedFile(request: Express.Request, receivedHash: string): Promise<UploadedFile> {
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
    if (file.truncated) {
        throw badRequest("File upload failed (truncated)")
    }
    const localHash = await sha256File(file.tempFilePath);
    if(localHash !== receivedHash) {
        throw badRequest(`Received hash ${receivedHash} does not match ${localHash}`)
    }
    return file;
}
