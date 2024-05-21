import { OpenAPIV3 } from "express-oas-generator";
import {
    addTag,
    setControllerTag,
    requireDefined,
    badRequest,
    getRequestBody,
    getDefaultResponsesNoContent,
    Log
} from "@logion/rest-api-core";
import { injectable } from "inversify";
import { Controller, HttpPost, ApiController, Async, SendsResponse } from "dinoloop";
import { components } from "./components.js";
import { SecretRecoveryRequestFactory, SecretRecoveryRequestDescription } from "../model/secret_recovery.model.js";
import { SecretRecoveryRequestService } from "../services/secret_recovery.service.js";
import { LocRequestRepository } from "../model/locrequest.model.js";
import moment from "moment";
import { NotificationRecipient, Template, NotificationService } from "../services/notification.service.js";
import { UserPrivateData } from "./adapters/locrequestadapter.js";
import { LocalsObject } from "pug";
import { DirectoryService } from "../services/directory.service.js";
import { ValidAccountId } from "@logion/node-api";

type CreateSecretRecoveryRequestView = components["schemas"]["CreateSecretRecoveryRequestView"];

const { logger } = Log;

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'SecretRecovery';
    addTag(spec, {
        name: tagName,
        description: "Handling of Secret Recovery Requests"
    });
    setControllerTag(spec, /^\/api\/secret-recovery.*/, tagName);

    SecretRecoveryController.createSecretRecoveryRequest(spec);
}

@injectable()
@Controller('/secret-recovery')
export class SecretRecoveryController extends ApiController {

    constructor(
        private secretRecoveryRequestFactory: SecretRecoveryRequestFactory,
        private secretRecoveryRequestService: SecretRecoveryRequestService,
        private locRequestRepository: LocRequestRepository,
        private directoryService: DirectoryService,
        private notificationService: NotificationService,
    ) {
        super();
    }

    static createSecretRecoveryRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/secret-recovery"].post!;
        operationObject.summary = "Creates a new Secret recovery request";
        operationObject.description = "This is publicly available";
        operationObject.requestBody = getRequestBody({
            description: "Secret recovery request creation data",
            view: "CreateSecretRecoveryRequestView",
        });
        operationObject.responses = getDefaultResponsesNoContent();
    }

    @Async()
    @HttpPost('')
    @SendsResponse()
    async createSecretRecoveryRequest(body: CreateSecretRecoveryRequestView) {
        const { requesterIdentityLocId, challenge, secretName } = body;
        const requesterIdentityLoc = requireDefined(
            await this.locRequestRepository.findById(requesterIdentityLocId),
            () => badRequest("Identity LOC not found")
        );
        requireDefined(
            requesterIdentityLoc.secrets?.find(secret => secret.name === secretName),
            () => badRequest("Secret not found")
        )
        const userIdentity = {
            firstName: body.userIdentity.firstName || "",
            lastName: body.userIdentity.lastName || "",
            email: body.userIdentity.email || "",
            phoneNumber: body.userIdentity.phoneNumber || "",
        };
        const userPostalAddress = {
            line1: body.userPostalAddress.line1 || "",
            line2: body.userPostalAddress.line2 || "",
            postalCode: body.userPostalAddress.postalCode || "",
            city: body.userPostalAddress.city || "",
            country: body.userPostalAddress.country || "",
        };
        const recoveryRequest = this.secretRecoveryRequestFactory.newSecretRecoveryRequest({
            requesterIdentityLocId,
            legalOfficerAddress: requesterIdentityLoc.getOwner(),
            challenge,
            secretName,
            userIdentity,
            userPostalAddress,
            createdOn: moment()
        })
        await this.secretRecoveryRequestService.add(recoveryRequest);
        const userPrivateData: UserPrivateData = {
            identityLocId: requesterIdentityLocId,
            userIdentity,
            userPostalAddress,
        }
        this.notify("WalletUser", "secret-recovery-requested-user", recoveryRequest.getDescription(), requesterIdentityLoc.getOwner(), userPrivateData);
        this.notify("LegalOfficer", "secret-recovery-requested-legal-officer", recoveryRequest.getDescription(), requesterIdentityLoc.getOwner(), userPrivateData);
        this.response.sendStatus(204);
    }

    private notify(recipient: NotificationRecipient, templateId: Template, secretRecoveryRequest: SecretRecoveryRequestDescription, legalOfficerAccount: ValidAccountId, userPrivateData: UserPrivateData): void {
        this.getNotificationInfo(secretRecoveryRequest, legalOfficerAccount, userPrivateData)
            .then(info => {
                const to = recipient === "WalletUser" ? info.userEmail : info.legalOfficerEMail
                return this.notificationService.notify(to, templateId, info.data)
                    .catch(reason => logger.warn("Failed to send email '%s' to %s : %s", templateId, to, reason))
            })
            .catch(reason =>
                logger.warn("Failed to retrieve notification info from directory: %s. Mail '%' not sent.", reason, templateId)
            )
    }

    private async getNotificationInfo(secretRecoveryRequest: SecretRecoveryRequestDescription, legalOfficerAccount: ValidAccountId, userPrivateData: UserPrivateData):
        Promise<{ legalOfficerEMail: string, userEmail: string | undefined, data: LocalsObject }> {

        const legalOfficer = await this.directoryService.get(legalOfficerAccount)
        const { userIdentity, userPostalAddress } = userPrivateData;
        return {
            legalOfficerEMail: legalOfficer.userIdentity.email,
            userEmail: userIdentity?.email,
            data: {
                secretName: secretRecoveryRequest.secretName,
                legalOfficer,
                walletUser: userIdentity,
                walletUserPostalAddress: userPostalAddress
            }
        }
    }
}
