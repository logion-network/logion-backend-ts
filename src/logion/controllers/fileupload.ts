import { UploadedFile, FileArray } from "express-fileupload";
import { badRequest } from "@logion/rest-api-core";
import { sha256File } from "../lib/crypto/hashing.js";
import { Hash } from "@logion/node-api";

export async function getUploadedFile(request: Express.Request, receivedHash: Hash): Promise<UploadedFile> {
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
    if(!localHash.equalTo(receivedHash)) {
        throw badRequest(`Received hash ${ receivedHash.toHex() } does not match ${ localHash.toHex() }`)
    }
    file.name = Buffer.from(file.name, 'latin1').toString();
    return file;
}
