import { ApiController, Controller, HttpPut, Async, HttpGet, SendsResponse } from "dinoloop";
import { injectable } from "inversify";
import { LoFileRepository, LoFileFactory } from "../model/lofile.model";
import { FileStorageService } from "../services/file.storage.service";
import { getUploadedFile } from "./fileupload";
import { AuthenticationService } from "../services/authentication.service";
import { requireDefined } from "../lib/assertions";
import { badRequest } from "./errors";
import { rm } from "fs/promises";
import { Log } from "../util/Log";
import { OpenAPIV3 } from "express-oas-generator";
import {
    setPathParameters,
    getDefaultResponsesNoContent,
    addTag,
    setControllerTag,
    getDefaultResponsesWithAnyBody
} from "./doc";

const { logger } = Log;

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'LO Files';
    addTag(spec, {
        name: tagName,
        description: "Handling of Legal Officer Files"
    });
    setControllerTag(spec, /^\/api\/lo-file.*/, tagName);

    LoFileController.uploadFile(spec);
    LoFileController.downloadFile(spec);
}

@injectable()
@Controller('/lo-file')
export class LoFileController extends ApiController {

    constructor(
        private fileStorageService: FileStorageService,
        private authenticationService: AuthenticationService,
        private loFileRepository: LoFileRepository,
        private loFileFactory: LoFileFactory) {
        super();
    }

    static uploadFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/lo-file/{id}"].put!;
        operationObject.summary = "Uploads a Legal Officer file";
        operationObject.description = "The authenticated user must be the node owner.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'id': "The well-known id of the file, for instance 'sof-header' or 'sof-oath'"
        });
    }

    @HttpPut("/:id")
    @Async()
    @SendsResponse()
    async uploadFile(_body: any, id: string): Promise<void> {

        (await this.authenticationService.authenticatedUser(this.request))
            .require(user => user.isNodeOwner());

        const existingLoFile = await this.loFileRepository.findById(id);
        const file = getUploadedFile(this.request)
        if (existingLoFile) {
            const oidToRemove = existingLoFile.oid;
            const oid = await this.fileStorageService.importFileInDB(file.tempFilePath, id);
            existingLoFile.update({
                contentType: file.mimetype,
                oid
            })
            await this.loFileRepository.save(existingLoFile);
            await this.fileStorageService.deleteFile({ oid: oidToRemove });
        } else {
            const oid = await this.fileStorageService.importFileInDB(file.tempFilePath, id);
            const loFile = this.loFileFactory.newLoFile({
                id,
                contentType: file.mimetype,
                oid,
            })
            await this.loFileRepository.save(loFile);
        }
        this.response.sendStatus(204);
    }

    static downloadFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/lo-file/{id}"].get!;
        operationObject.summary = "Downloads a Legal Officer file";
        operationObject.description = "The authenticated user must be the node owner.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            'id': "The well-known id of the file, for instance 'sof-header' or 'sof-oath'"
        });
    }

    @HttpGet('/:id')
    @Async()
    @SendsResponse()
    async downloadFile(_body: any, id: string): Promise<void> {
        (await this.authenticationService.authenticatedUser(this.request))
            .require(user => user.isNodeOwner());
        const file = requireDefined(
            await this.loFileRepository.findById(id),
            () => badRequest(`LO has not yet uploaded file with id ${ id }`)
        )
        const tempFilePath = "/tmp/download-" + id;
        await this.fileStorageService.exportFile(file, tempFilePath);
        this.response.download(tempFilePath, file.id, { headers: { "content-type": file.contentType } }, (error: any) => {
            rm(tempFilePath);
            if(error) {
                logger.error("Download failed: %s", error);
            }
        });
    }
}
