import { OpenAPIV3 } from "express-oas-generator";
import { v4 as uuid } from "uuid";
import {
    addTag,
    setControllerTag,
    requireDefined,
    badRequest,
    getRequestBody,
    getDefaultResponsesNoContent,
    Log,
    AuthenticationService,
    getDefaultResponses,
    setPathParameters
} from "@logion/rest-api-core";
import { injectable } from "inversify";
import { Controller, HttpPost, ApiController, Async, SendsResponse, HttpPut } from "dinoloop";
import { components } from "./components.js";
import { SecretRecoveryRequestFactory, SecretRecoveryRequestDescription, SecretRecoveryRequestRepository } from "../model/secret_recovery.model.js";
import { SecretRecoveryRequestService } from "../services/secret_recovery.service.js";
import { LocRequestAggregateRoot, LocRequestRepository } from "../model/locrequest.model.js";
import moment from "moment";
import { NotificationRecipient, Template, NotificationService } from "../services/notification.service.js";
import { UserPrivateData } from "./adapters/locrequestadapter.js";
import { LocalsObject } from "pug";
import { DirectoryService } from "../services/directory.service.js";
import { UUID, ValidAccountId } from "@logion/node-api";
import { LegalOfficerDecisionDescription } from "../model/decision.js";

type CreateSecretRecoveryRequestView = components["schemas"]["CreateSecretRecoveryRequestView"];
type RecoveryInfoView = components["schemas"]["RecoveryInfoView"];
type RecoveryInfoIdentityView = components["schemas"]["RecoveryInfoIdentityView"];
type RejectRecoveryRequestView = components["schemas"]["RejectRecoveryRequestView"];
type DownloadSecretRequestView = components["schemas"]["DownloadSecretRequestView"];
type DownloadSecretResponseView = components["schemas"]["DownloadSecretResponseView"];
type SecretRecoveryView = components["schemas"]["SecretRecoveryView"];

const { logger } = Log;

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'SecretRecovery';
    addTag(spec, {
        name: tagName,
        description: "Handling of Secret Recovery Requests"
    });
    setControllerTag(spec, /^\/api\/secret-recovery.*/, tagName);

    SecretRecoveryController.createSecretRecoveryRequest(spec);
    SecretRecoveryController.fetchRecoveryInfo(spec);
    SecretRecoveryController.rejectRequest(spec);
    SecretRecoveryController.acceptRequest(spec);
    SecretRecoveryController.downloadSecret(spec);
}

@injectable()
@Controller('/secret-recovery')
export class SecretRecoveryController extends ApiController {

    constructor(
        private secretRecoveryRequestFactory: SecretRecoveryRequestFactory,
        private secretRecoveryRequestService: SecretRecoveryRequestService,
        private secretRecoveryRequestRepository: SecretRecoveryRequestRepository,
        private locRequestRepository: LocRequestRepository,
        private directoryService: DirectoryService,
        private notificationService: NotificationService,
        private authenticationService: AuthenticationService,
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
        operationObject.responses = getDefaultResponses("SecretRecoveryView");
    }

    @Async()
    @HttpPost('')
    async createSecretRecoveryRequest(body: CreateSecretRecoveryRequestView): Promise<SecretRecoveryView> {
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
        const id = uuid();
        const recoveryRequest = this.secretRecoveryRequestFactory.newSecretRecoveryRequest({
            id,
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
        return { id };
    }

    private notify(recipient: NotificationRecipient, templateId: Template, secretRecoveryRequest: SecretRecoveryRequestDescription, legalOfficerAccount: ValidAccountId, userPrivateData: UserPrivateData, decision?: LegalOfficerDecisionDescription): void {
        this.getNotificationInfo(secretRecoveryRequest, legalOfficerAccount, userPrivateData, decision)
            .then(info => {
                const to = recipient === "WalletUser" ? info.userEmail : info.legalOfficerEMail
                return this.notificationService.notify(to, templateId, info.data)
                    .catch(reason => logger.warn("Failed to send email '%s' to %s : %s", templateId, to, reason))
            })
            .catch(reason =>
                logger.warn("Failed to retrieve notification info from directory: %s. Mail '%' not sent.", reason, templateId)
            )
    }

    private async getNotificationInfo(secretRecoveryRequest: SecretRecoveryRequestDescription, legalOfficerAccount: ValidAccountId, userPrivateData: UserPrivateData, decision?: LegalOfficerDecisionDescription):
        Promise<{ legalOfficerEMail: string, userEmail: string | undefined, data: LocalsObject }> {

        const legalOfficer = await this.directoryService.get(legalOfficerAccount)
        const { userIdentity, userPostalAddress } = userPrivateData;
        return {
            legalOfficerEMail: legalOfficer.userIdentity.email,
            userEmail: userIdentity?.email,
            data: {
                legalOfficer,
                walletUser: userIdentity,
                walletUserPostalAddress: userPostalAddress,
                secret: toNotificationModel(secretRecoveryRequest, decision),
            }
        }
    }

    static fetchRecoveryInfo(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/secret-recovery/{id}/recovery-info"].put!;
        operationObject.summary = "Fetch all info necessary for the legal officer to accept or reject secret recovery request.";
        operationObject.description = "The authentication user must be a legal officers on current node";
        operationObject.responses = getDefaultResponses("RecoveryInfoView");
        setPathParameters(operationObject, { 'id': "The ID of the recovery request" });
    }

    @Async()
    @HttpPut('/:id/recovery-info')
    async fetchRecoveryInfo(_body: never, id: string): Promise<RecoveryInfoView> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);

        const secretRecoveryRequest = await this.secretRecoveryRequestRepository.findById(id);
        if(secretRecoveryRequest === null) {
            throw badRequest("Pending secret recovery request not found");
        }

        const secretRecoveryRequestDescription = secretRecoveryRequest.getDescription();
        const identity1Loc = await this.locRequestRepository.findById(secretRecoveryRequestDescription.requesterIdentityLocId);
        let identity1: RecoveryInfoIdentityView | undefined;
        if(identity1Loc && identity1Loc.getOwner().equals(authenticatedUser.validAccountId)) {
            const description = identity1Loc.getDescription();
            identity1 = {
                userIdentity: description.userIdentity,
                userPostalAddress: description.userPostalAddress,
            };
        }
        return {
            identity1,
            identity2: {
                userIdentity: secretRecoveryRequestDescription.userIdentity,
                userPostalAddress: secretRecoveryRequestDescription.userPostalAddress,
            },
            type: "SECRET",
        };
    }

    static rejectRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/secret-recovery/{id}/reject"].post!;
        operationObject.summary = "Rejects a request";
        operationObject.description = "The authenticated user must be one of the legal officers of the request";
        operationObject.requestBody = getRequestBody({
            description: "Request rejection data",
            view: "RejectRecoveryRequestView",
        });
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'id': "The ID of the request to reject" });
    }

    @Async()
    @HttpPost('/:id/reject')
    @SendsResponse()
    async rejectRequest(body: RejectRecoveryRequestView, id: string): Promise<void> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        let requesterIdentityLoc: LocRequestAggregateRoot | null = null;
        const recoveryRequest = await this.secretRecoveryRequestService.update(id, async request => {
            requesterIdentityLoc = await this.locRequestRepository.findById(request.getDescription().requesterIdentityLocId);
            authenticatedUser.require(user => user.is(requesterIdentityLoc?.getOwner()));
            request.reject(body.rejectReason!, moment());
        });
        const description = recoveryRequest.getDescription();
        const userPrivateData: UserPrivateData = {
            identityLocId: description.requesterIdentityLocId,
            userIdentity: description.userIdentity,
            userPostalAddress: description.userPostalAddress,
        };
        this.notify("WalletUser", "secret-recovery-rejected", recoveryRequest.getDescription(), requesterIdentityLoc!.getOwner(), userPrivateData, recoveryRequest.getDecision());
        this.response.sendStatus(204);
    }

    static acceptRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/secret-recovery/{id}/accept"].post!;
        operationObject.summary = "Accepts a request";
        operationObject.description = "The authenticated user must be one of the legal officers of the request";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, { 'id': "The ID of the request to accept" });
    }

    @Async()
    @HttpPost('/:id/accept')
    @SendsResponse()
    async acceptRequest(_body: never, id: string): Promise<void> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        let requesterIdentityLoc: LocRequestAggregateRoot | null = null;
        const recoveryRequest = await this.secretRecoveryRequestService.update(id, async request => {
            requesterIdentityLoc = await this.locRequestRepository.findById(request.getDescription().requesterIdentityLocId);
            authenticatedUser.require(user => user.is(requesterIdentityLoc?.getOwner()));
            request.accept(moment());
        });
        const description = recoveryRequest.getDescription();
        const userPrivateData: UserPrivateData = {
            identityLocId: description.requesterIdentityLocId,
            userIdentity: description.userIdentity,
            userPostalAddress: description.userPostalAddress,
        };
        this.notify("WalletUser", "secret-recovery-accepted", recoveryRequest.getDescription(), requesterIdentityLoc!.getOwner(), userPrivateData, recoveryRequest.getDecision());
        this.response.sendStatus(204);
    }

    static downloadSecret(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/secret-recovery/{id}/download-secret"].put!;
        operationObject.summary = "Returns the secret value associated to this request if it was accepted";
        operationObject.description = "This is publicly available";
        operationObject.responses = getDefaultResponses("DownloadSecretResponseView");
        setPathParameters(operationObject, { 'id': "The ID of the request" });
    }

    @Async()
    @HttpPut('/:id/download-secret')
    async downloadSecret(body: DownloadSecretRequestView, id: string): Promise<DownloadSecretResponseView> {
        const challenge = requireDefined(body.challenge, () => badRequest("Missing challenge"));
        const request = await this.secretRecoveryRequestRepository.findById(id);
        if(request === null) {
            throw badRequest(`No request with ID ${id}`);
        }
        const requesterIdentityLoc = await this.locRequestRepository.findById(request.getDescription().requesterIdentityLocId);
        if(!requesterIdentityLoc) {
            throw new Error("Identity LOC not found");
        }

        const now = moment();
        try {
            await this.secretRecoveryRequestService.update(id, async request => {
                request.markDownloaded(now, challenge, true);
            });
        } catch(e) {
            if(e instanceof Error) {
                throw badRequest(e.message);
            } else {
                throw e;
            }
        }
        return {
            value: requesterIdentityLoc.getSecretOrThrow(request.getDescription().secretName),
        }
    }
}

export function toNotificationModel(secret: SecretRecoveryRequestDescription, decision?: LegalOfficerDecisionDescription):
    SecretRecoveryRequestDescription & { decision?: LegalOfficerDecisionDescription }
{
    return {
        ...secret,
        requesterIdentityLocId: new UUID(secret.requesterIdentityLocId).toDecimalString(),
        decision
    };
}
