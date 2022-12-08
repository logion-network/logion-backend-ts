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
import { LoFileService } from "../services/lofile.service";

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
        private loFileFactory: LoFileFactory,
        private loFileService: LoFileService,
    ) {
        super();
    }

    static uploadFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/lo-file/{legalOfficerAddress}/{id}"].put!;
        operationObject.summary = "Uploads a Legal Officer file";
        operationObject.description = "The authenticated user must be a LO attached to the node.";
        operationObject.responses = getDefaultResponsesNoContent();
        operationObject.requestBody = getRequestBody({
            description: "File upload data",
            view: "FileUploadData",
        });
        setPathParameters(operationObject, {
            legalOfficerAddress: "The address of the LO",
            id: "The well-known id of the file, for instance 'sof-header' or 'sof-oath'"
        });
    }

    @HttpPut("/:legalOfficerAddress/:id")
    @Async()
    @SendsResponse()
    async uploadFile(body: FileUploadData, legalOfficerAddress: string, id: string): Promise<void> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        authenticatedUser.require(user => user.is(legalOfficerAddress));

        const file = await getUploadedFile(this.request, requireDefined(body.hash, () => badRequest("No hash found for upload file")));
        const existingLoFile = await this.loFileRepository.findById({ id, legalOfficerAddress } );
        if (existingLoFile) {
            const oidToRemove = existingLoFile.oid;
            const oid = await this.fileStorageService.importFileInDB(file.tempFilePath, id);
            await this.loFileService.updateLoFile({ id, legalOfficerAddress }, async loFile => {
                loFile.update({
                    contentType: file.mimetype,
                    oid
                });
            });
            await this.fileStorageService.deleteFile({ oid: oidToRemove });
        } else {
            const oid = await this.fileStorageService.importFileInDB(file.tempFilePath, id);
            const loFile = this.loFileFactory.newLoFile({
                id,
                legalOfficerAddress,
                contentType: file.mimetype,
                oid,
            })
            await this.loFileService.addLoFile(loFile);
        }
        this.response.sendStatus(204);
    }

    static downloadFile(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/lo-file/{legalOfficerAddress}/{id}"].get!;
        operationObject.summary = "Downloads a Legal Officer file";
        operationObject.description = "The authenticated user must be a LO attached to the node.";
        operationObject.responses = getDefaultResponsesWithAnyBody();
        setPathParameters(operationObject, {
            legalOfficerAddress: "The address of the LO",
            id: "The well-known id of the file, for instance 'sof-header' or 'sof-oath'"
        });
    }

    @HttpGet('/:legalOfficerAddress/:id')
    @Async()
    @SendsResponse()
    async downloadFile(_body: any, legalOfficerAddress: string, id: string): Promise<void> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        authenticatedUser.require(user => user.is(legalOfficerAddress));
        const file = requireDefined(
            await this.loFileRepository.findById({ id, legalOfficerAddress }),
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
