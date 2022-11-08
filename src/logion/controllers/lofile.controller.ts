import { ApiController, Controller, HttpPut, Async, HttpGet, SendsResponse } from "dinoloop";
import { injectable } from "inversify";
import {
    badRequest,
    setPathParameters,
    getDefaultResponsesNoContent,
    addTag,
    setControllerTag,
    getDefaultResponsesWithAnyBody,
    requireDefined,
    AuthenticationService,
    getRequestBody,
} from "@logion/rest-api-core";
import { OpenAPIV3 } from "express-oas-generator";

import { LoFileRepository, LoFileFactory } from "../model/lofile.model";
import { FileStorageService } from "../services/file.storage.service";
import { getUploadedFile } from "./fileupload";
import { downloadAndClean } from "../lib/http";
import { components } from "./components";

type FileUploadData = components["schemas"]["FileUploadData"];

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
        operationObject.requestBody = getRequestBody({
            description: "File upload data",
            view: "FileUploadData",
        });
        setPathParameters(operationObject, {
            'id': "The well-known id of the file, for instance 'sof-header' or 'sof-oath'"
        });
    }

    @HttpPut("/:id")
    @Async()
    @SendsResponse()
    async uploadFile(body: FileUploadData, id: string): Promise<void> {

        (await this.authenticationService.authenticatedUser(this.request))
            .require(user => user.isNodeOwner());

        const existingLoFile = await this.loFileRepository.findById(id);
        const file = await getUploadedFile(this.request, requireDefined(body.hash, () => badRequest("No hash found for upload file")));
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

        downloadAndClean({
            response: this.response,
            path: tempFilePath,
            name: requireDefined(file.id),
            contentType: requireDefined(file.contentType),
        });
    }
}
