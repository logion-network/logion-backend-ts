import { Log, requireDefined } from "@logion/rest-api-core";
import { Hash } from "@logion/node-api";
import { AxiosError, AxiosInstance } from "axios";
import { injectable } from "inversify";
import { DateTime } from "luxon";
import { LocRequestService } from "../locrequest.service.js";
import {
    LocRequestAggregateRoot,
    LocRequestRepository,
} from "../../model/locrequest.model.js";
import { IdenfyCallbackPayload, IdenfyCallbackPayloadFileTypes, IdenfyVerificationSession } from "./idenfy.types.js";
import { createWriteStream } from "fs";
import { writeFile, stat } from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import { sha256File } from '../../lib/crypto/hashing.js';
import { FileStorageService } from "../file.storage.service.js";
import { AxiosFactory } from "../axiosfactory.service.js";
import { FileParams } from "src/logion/model/loc_items.js";

const { logger } = Log;

export interface IdenfyVerificationCreation {
    successUrl: string;
    errorUrl: string;
    unverifiedUrl: string;
}

export interface IdenfyVerificationRedirect {
    url: string;
}

interface IPFSFile {
    hash: Hash;
    cid: string;
    size: number;
}

export abstract class IdenfyService {

    abstract createVerificationSession(request: LocRequestAggregateRoot, idenfyVerificationCreation: IdenfyVerificationCreation): Promise<IdenfyVerificationRedirect>;

    abstract callback(json: IdenfyCallbackPayload, raw: Buffer, idenfySignature: string): Promise<void>;

    abstract redirectUrl(authToken: string): string;
}

@injectable()
export class DisabledIdenfyService extends IdenfyService {

    override async createVerificationSession(): Promise<IdenfyVerificationRedirect> {
        throw new Error("iDenfy integration is disabled");
    }

    override async callback(): Promise<void> {
        throw new Error("iDenfy integration is disabled");
    }

    override redirectUrl(): string {
        throw new Error("iDenfy integration is disabled");
    }
}

@injectable()
export class EnabledIdenfyService extends IdenfyService {

    static IDENFY_BASE_URL = "https://ivs.idenfy.com/api/v2";

    constructor(
        private locRequestRepository: LocRequestRepository,
        private locRequestService: LocRequestService,
        private fileStorageService: FileStorageService,
        private axiosFactory: AxiosFactory,
    ) {
        super();

        this.baseUrl = requireDefined(process.env.BASE_URL, () => new Error("Missing BASE_URL"));
        const apiKey = requireDefined(process.env.IDENFY_API_KEY, () => new Error("Missing IDENFY_API_KEY"));
        const apiSecret = requireDefined(process.env.IDENFY_API_SECRET, () => new Error("Missing IDENFY_API_SECRET"));
        logger.info("EnabledIdenfyService - API Key: %s", apiKey);
        this.signingKey = requireDefined(process.env.IDENFY_SIGNING_KEY, () => new Error("Missing IDENFY_SIGNING_KEY"));
        this.axios = this.axiosFactory.create({
            baseURL: EnabledIdenfyService.IDENFY_BASE_URL,
            auth: {
                username: apiKey,
                password: apiSecret,
            }
        });
    }

    private readonly baseUrl: string;

    private readonly signingKey: string;

    private readonly axios: AxiosInstance;

    override async createVerificationSession(request: LocRequestAggregateRoot, idenfyVerificationCreation: IdenfyVerificationCreation): Promise<IdenfyVerificationRedirect> {
        const canVerify = request.canInitIdenfyVerification();
        if(!canVerify.result) {
            throw new Error(canVerify.error);
        }

        const requestId = requireDefined(request.id);
        try {
            const response = await this.axios.post("/token", {
                clientId: requestId,
                firstName: request.getDescription().userIdentity?.firstName,
                lastName: request.getDescription().userIdentity?.lastName,
                successUrl: idenfyVerificationCreation.successUrl,
                errorUrl: idenfyVerificationCreation.errorUrl,
                unverifiedUrl: idenfyVerificationCreation.unverifiedUrl,
                callbackUrl: `${ this.baseUrl }/api/idenfy/callback`,
            });

            const session: IdenfyVerificationSession = response.data;
            await this.locRequestService.update(requestId, async request => {
                request.initIdenfyVerification(session);
            });
            return {
                url: this.redirectUrl(session.authToken),
            };
        } catch(e) {
            const axiosError = e as AxiosError;
            logger.error("BEGIN iDenfy create session error:");
            logger.error(axiosError.response?.data);
            logger.error("END iDenfy create session error");
            throw e;
        }
    }

    override redirectUrl(authToken: string): string {
        return `${ EnabledIdenfyService.IDENFY_BASE_URL }/redirect?authToken=${ authToken }`;
    }

    override async callback(json: IdenfyCallbackPayload, raw: Buffer, idenfySignature: string): Promise<void> {
        const hmac = crypto.createHmac('sha256', this.signingKey);
        const hexDigest = hmac.update(raw).digest('hex');
        const digest = Buffer.from(hexDigest);
        const checksum = Buffer.from(idenfySignature);

        if (!crypto.timingSafeEqual(checksum, digest)) {
            throw new Error(`Request body digest (${digest}) did not match Idenfy-Signature (${checksum}).`)
        }

        let files: FileParams[];
        if(json.status.overall === "APPROVED" || json.status.overall === "SUSPECTED") {
            files = await this.downloadFiles(json, raw);
        } else {
            files = [];
        }

        await this.locRequestService.update(json.clientId, async request => {
            request.updateIdenfyVerification(json, raw.toString());
            for(const file of files) {
                request.addFile(file, "MANUAL_BY_USER");
            }   
        });
    }

    private async downloadFiles(json: IdenfyCallbackPayload, raw: Buffer): Promise<FileParams[]> {
        const files: FileParams[] = [];

        const clientId = json.clientId;
        const request = requireDefined(await this.locRequestRepository.findById(clientId));
        const submitter = request.getOwner();

        const randomPrefix = DateTime.now().toMillis().toString();
        const { hash, cid, size } = await this.storePayload(randomPrefix, raw);
        files.push({
            contentType: "application/json",
            name: "idenfy-callback-payload.json",
            nature: "iDenfy Verification Result",
            submitter,
            hash,
            cid,
            restrictedDelivery: false,
            size,
        });

        for(const fileType of IdenfyCallbackPayloadFileTypes) {
            const fileUrlString = json.fileUrls[fileType];
            if(fileUrlString) {
                const { fileName, hash, cid, contentType, size } = await this.storeFile(randomPrefix, fileUrlString);
                files.push({
                    name: fileName,
                    nature: `iDenfy ${ fileType }`,
                    submitter,
                    contentType,
                    hash,
                    cid,
                    restrictedDelivery: false,
                    size,
                });
            }
        }

        return files;
    }

    private async storePayload(tempFileNamePrefix: string, raw: Buffer): Promise<IPFSFile> {
        const fileName = path.join(os.tmpdir(), `${ tempFileNamePrefix }-idenfy-callback-payload.json`);
        await writeFile(fileName, raw);
        return await this.hashAndImport(fileName);
    }

    private async hashAndImport(fileName: string): Promise<IPFSFile> {
        const hash = await sha256File(fileName);
        const stats = await stat(fileName);
        const size = stats.size;
        const cid = await this.fileStorageService.importFile(fileName);
        return { hash, cid, size };
    }

    private async storeFile(tempFileNamePrefix: string, fileUrlString: string): Promise<IPFSFile & { fileName: string, contentType: string }> {
        const fileUrl = new URL(fileUrlString);
        const fileUrlPath = fileUrl.pathname;
        const fileUrlPathElements = fileUrlPath.split("/");
        const fileName = fileUrlPathElements[fileUrlPathElements.length - 1];
        const tempFileName = path.join(os.tmpdir(), `${ tempFileNamePrefix }-${ fileName }`);
        const writer = createWriteStream(tempFileName);
        const response = await this.axiosFactory.create().get(fileUrlString, { responseType: "stream" });
        let contentType = "application/octet-stream";
        if('content-type' in response.headers && response.headers['content-type']) {
            contentType = response.headers['content-type'];
        }
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve)
            writer.on('error', reject)
        });
        await new Promise<void>((resolve, reject) => {
            writer.close(err => {
                if(err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        const ipfsFile = await this.hashAndImport(tempFileName);
        return {
            ...ipfsFile,
            fileName,
            contentType
        };
    }
}
