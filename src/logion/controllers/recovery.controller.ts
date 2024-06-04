import { OpenAPIV3 } from "express-oas-generator";
import {
    addTag,
    setControllerTag,
    requireDefined,
    getDefaultResponses,
    AuthenticationService,
} from "@logion/rest-api-core";
import { injectable } from "inversify";
import { Controller, HttpPut, ApiController, Async } from "dinoloop";
import { components } from "./components.js";
import { SecretRecoveryRequestRepository, SecretRecoveryRequestAggregateRoot } from "../model/secret_recovery.model.js";
import { LocRequestAdapter } from "./adapters/locrequestadapter.js";
import { FetchAccountRecoveryRequestsSpecification, AccountRecoveryRequestAggregateRoot, AccountRecoveryRepository } from "../model/account_recovery.model.js";

type RecoveryRequestView = components["schemas"]["RecoveryRequestView"];
type RecoveryRequestsView = components["schemas"]["RecoveryRequestsView"];

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Recovery';
    addTag(spec, {
        name: tagName,
        description: "Handling of Recovery Requests"
    });
    setControllerTag(spec, /^\/api\/recovery-requests.*/, tagName);

    RecoveryController.fetchRecoveryRequests(spec);
}

@injectable()
@Controller('/recovery-requests')
export class RecoveryController extends ApiController {

    constructor(
        private authenticationService: AuthenticationService,
        private secretRecoveryRequestRepository: SecretRecoveryRequestRepository,
        private accountRecoveryRequestRepository: AccountRecoveryRepository,
        private locRequestAdapter: LocRequestAdapter,
    ) {
        super();
    }

    static fetchRecoveryRequests(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/recovery-requests"].put!;
        operationObject.summary = "Fetches recovery request";
        operationObject.description = "Only for LLOs on current node";
        operationObject.responses = getDefaultResponses("RecoveryRequestsView");
    }

    @Async()
    @HttpPut('')
    async fetchRecoveryRequests(): Promise<RecoveryRequestsView> {
        const authenticatedUser = await this.authenticationService.authenticatedUserIsLegalOfficerOnNode(this.request);
        const legalOfficer = authenticatedUser.validAccountId;

        const accountRecoveryRequests = await this.accountRecoveryRequestRepository.findBy(
            new FetchAccountRecoveryRequestsSpecification({
                expectedLegalOfficerAddress: [ legalOfficer ],
            })
        );
        const secretRecoveryRequests = await this.secretRecoveryRequestRepository.findByLegalOfficer(legalOfficer);
        const view: RecoveryRequestsView = {
            requests: [],
        };
        for(const request of accountRecoveryRequests) {
            view.requests?.push(await this.toAccountRecoveryRequestView(request));
        }
        for(const request of secretRecoveryRequests) {
            view.requests?.push(this.toSecretRecoveryRequestView(request));
        }
        return view;
    }

    private async toAccountRecoveryRequestView(accountRecoveryRequest: AccountRecoveryRequestAggregateRoot): Promise<RecoveryRequestView> {
        const description = accountRecoveryRequest.getDescription();
        const { userIdentity, userPostalAddress } = requireDefined(
            await this.locRequestAdapter.getUserPrivateData(description.requesterIdentityLocId)
        );
        return {
            createdOn: description.createdOn,
            id: description.id,
            status: description.status,
            type: "ACCOUNT",
            userIdentity: requireDefined(userIdentity),
            userPostalAddress: requireDefined(userPostalAddress),
            rejectReason: accountRecoveryRequest.getDecision()?.rejectReason,
        };
    }

    private toSecretRecoveryRequestView(secretRecoveryRequest: SecretRecoveryRequestAggregateRoot): RecoveryRequestView {
        const description = secretRecoveryRequest.getDescription();
        return {
            createdOn: description.createdOn.toISOString(),
            id: description.id,
            status: description.status,
            type: "SECRET",
            userIdentity: description.userIdentity,
            userPostalAddress: description.userPostalAddress,
            rejectReason: secretRecoveryRequest.getDecision()?.rejectReason,
        };
    }
}
