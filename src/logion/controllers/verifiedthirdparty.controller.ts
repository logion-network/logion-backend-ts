import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpGet, HttpPut, HttpPost, HttpDelete, SendsResponse } from "dinoloop";
import { OpenAPIV3 } from "express-oas-generator";
import { addTag, AuthenticationService, badRequest, forbidden, getDefaultResponses, getDefaultResponsesNoContent, getRequestBody, Log, requireDefined, setControllerTag, setPathParameters } from "@logion/rest-api-core";
import { components } from "./components";
import { LocRequestAggregateRoot, LocRequestRepository } from "../model/locrequest.model";
import { VerifiedThirdPartySelectionRepository } from "../model/verifiedthirdpartyselection.model";
import { VerifiedThirdPartyAdapter } from "./adapters/verifiedthirdpartyadapter";
import { NotificationService } from "../services/notification.service";
import { DirectoryService } from "../services/directory.service";
import { LocRequestAdapter } from "./adapters/locrequestadapter";
import { VerifiedThirdPartySelectionService } from "../services/verifiedthirdpartyselection.service";
import { UserIdentity } from "../model/useridentity";

const { logger } = Log;

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Verified Third Parties';
    addTag(spec, {
        name: tagName,
        description: "Handling of Verified Third Parties"
    });
    setControllerTag(spec, /^\/api\/loc-request\/.*\/verified-third-party$/, tagName);
    setControllerTag(spec, /^\/api\/loc-request\/.*\/selected-parties\/.*/, tagName);
    setControllerTag(spec, /^\/api\/verified-third-parties.*/, tagName);
    setControllerTag(spec, /^\/api\/verified-third-party.*/, tagName);

    VerifiedThirdPartyController.nominateDismissVerifiedThirdParty(spec);
    VerifiedThirdPartyController.selectVerifiedThirdParty(spec);
    VerifiedThirdPartyController.unselectVerifiedThirdParty(spec);
    VerifiedThirdPartyController.getLegalOfficerVerifiedThirdParties(spec);
    VerifiedThirdPartyController.getVerifiedThirdPartyLocRequests(spec);
}

type SetVerifiedThirdPartyRequest = components["schemas"]["SetVerifiedThirdPartyRequest"];
type SelectVerifiedThirdPartyRequest = components["schemas"]["SelectVerifiedThirdPartyRequest"];
type VerifiedThirdPartiesView = components["schemas"]["VerifiedThirdPartiesView"];
type FetchLocRequestsResponseView = components["schemas"]["FetchLocRequestsResponseView"];

@injectable()
@Controller('')
export class VerifiedThirdPartyController extends ApiController {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private authenticationService: AuthenticationService,
        private verifiedThirdPartySelectionRepository: VerifiedThirdPartySelectionRepository,
        private verifiedThirdPartySelectionService: VerifiedThirdPartySelectionService,
        private verifiedThirdPartyAdapter: VerifiedThirdPartyAdapter,
        private notificationService: NotificationService,
        private directoryService: DirectoryService,
        private locRequestAdapter: LocRequestAdapter,
    ) {
        super();
    }

    static nominateDismissVerifiedThirdParty(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/verified-third-party"].put!;
        operationObject.summary = "Nominates or dismisses a VTP";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        operationObject.requestBody = getRequestBody({
            description: "VTP flag",
            view: "SetVerifiedThirdPartyRequest",
        });
        setPathParameters(operationObject, {
            'requestId': "The ID of the closed Identity LOC",
        });
    }

    @HttpPut('/loc-request/:requestId/verified-third-party')
    @Async()
    @SendsResponse()
    async nominateDismissVerifiedThirdParty(body: SetVerifiedThirdPartyRequest, requestId: string) {
        const authenticatedUser = await this.authenticationService.authenticatedUser(this.request);
        const nominated = body.isVerifiedThirdParty || false;
        const request = await this.verifiedThirdPartySelectionService.nominateDismiss(authenticatedUser, requestId, nominated);

        this.notifyVtpNominatedDismissed({
            legalOfficerAddress: authenticatedUser.address,
            nominated,
            vtp: request.getDescription().userIdentity,
        });

        this.response.sendStatus(204);
    }

    private async notifyVtpNominatedDismissed(args: {
        legalOfficerAddress: string,
        nominated: boolean,
        vtp?: UserIdentity,
    }) {
        const { legalOfficerAddress, nominated, vtp } = args;
        try {
            const legalOfficer = await this.directoryService.get(legalOfficerAddress);
            const data = {
                legalOfficer,
                walletUser: vtp,
            };
            if(nominated) {
                await this.notificationService.notify(vtp?.email, "vtp-nominated", data);
            } else {
                await this.notificationService.notify(vtp?.email, "vtp-dismissed", data);
            }
        } catch(e) {
            logger.error("Failed to notify VTP: %s. Mail '%s' not sent.", e, nominated ? "vtp-nominated" : "vtp-dismissed");
        }
    }

    static selectVerifiedThirdParty(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/selected-parties"].post!;
        operationObject.summary = "Selects a VTP for a given LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        operationObject.requestBody = getRequestBody({
            description: "The VTP to nominate",
            view: "SelectVerifiedThirdPartyRequest",
        });
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
        });
    }

    @HttpPost('/loc-request/:requestId/selected-parties')
    @Async()
    @SendsResponse()
    async selectVerifiedThirdParty(body: SelectVerifiedThirdPartyRequest, requestId: string) {
        const locRequest = requireDefined(await this.locRequestRepository.findById(requestId));
        const userCheck = await this.authenticationService.authenticatedUser(this.request);
        userCheck.require(user => user.is(locRequest.ownerAddress));

        const verifiedThirdPartyLocRequestId = requireDefined(body.identityLocId);
        const verifiedThirdPartyLocRequest = requireDefined(await this.locRequestRepository.findById(verifiedThirdPartyLocRequestId));
        try {
            await this.verifiedThirdPartySelectionService.selectUnselect(locRequest, verifiedThirdPartyLocRequest, true);
        } catch(e) {
            throw badRequest((e as Error).message);
        }

        this.notifyVtpSelectedUnselected({
            legalOfficerAddress: userCheck.address,
            selected: true,
            locRequest,
            vtp: verifiedThirdPartyLocRequest.getDescription().userIdentity,
        });

        this.response.sendStatus(204);
    }

    private async notifyVtpSelectedUnselected(args: {
        legalOfficerAddress: string,
        selected: boolean,
        locRequest: LocRequestAggregateRoot,
        vtp?: UserIdentity,
    }) {
        const { legalOfficerAddress, selected, locRequest, vtp } = args;
        try {
            const legalOfficer = await this.directoryService.get(legalOfficerAddress);
            const data = {
                legalOfficer,
                walletUser: vtp,
                loc: {
                    ...locRequest.getDescription(),
                    id: locRequest.id,
                }
            };
            if(selected) {
                await this.notificationService.notify(vtp?.email, "vtp-selected", data);
            } else {
                await this.notificationService.notify(vtp?.email, "vtp-unselected", data);
            }
        } catch(e) {
            logger.error("Failed to notify VTP: %s. Mail '%s' not sent.", e, selected ? "vtp-selected" : "vtp-unselected");
        }
    }

    static unselectVerifiedThirdParty(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request/{requestId}/selected-parties/{partyId}"].delete!;
        operationObject.summary = "Unselects a VTP for a given LOC";
        operationObject.description = "The authenticated user must be the owner of the LOC.";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'requestId': "The ID of the LOC",
            'partyId': "The VTP to exclude (by Identity LOC ID)",
        });
    }

    @HttpDelete('/loc-request/:requestId/selected-parties/:partyId')
    @Async()
    @SendsResponse()
    async unselectVerifiedThirdParty(_body: never, requestId: string, partyId: string) {
        const locRequest = requireDefined(await this.locRequestRepository.findById(requestId));
        const userCheck = await this.authenticationService.authenticatedUser(this.request);
        userCheck.require(user => user.is(locRequest.ownerAddress));

        const verifiedThirdPartyLocRequest = requireDefined(await this.locRequestRepository.findById(partyId));
        try {
            await this.verifiedThirdPartySelectionService.selectUnselect(locRequest, verifiedThirdPartyLocRequest, false);
        } catch(e) {
            throw badRequest((e as Error).message);
        }

        this.notifyVtpSelectedUnselected({
            legalOfficerAddress: userCheck.address,
            selected: false,
            locRequest,
            vtp: verifiedThirdPartyLocRequest.getDescription().userIdentity,
        });

        this.response.sendStatus(204);
    }

    static getLegalOfficerVerifiedThirdParties(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/verified-third-parties"].get!;
        operationObject.summary = "Lists the Verified Trusted Parties nominated by a given Legal Officer";
        operationObject.description = "The authenticated user must be a Legal Officer.";
        operationObject.responses = getDefaultResponses("VerifiedThirdPartiesView");
    }

    @HttpGet("/verified-third-parties")
    @Async()
    async getLegalOfficerVerifiedThirdParties(): Promise<VerifiedThirdPartiesView> {
        const userCheck = await this.authenticationService.authenticatedUser(this.request);
        if(! await userCheck.isLegalOfficer()) {
            throw forbidden("Not a Legal Officer");
        }
        const verifiedThirdParties = await this.locRequestRepository.findBy({
            expectedOwnerAddress: userCheck.address,
            isVerifiedThirdParty: true,
        });
        return this.verifiedThirdPartyAdapter.toViews(verifiedThirdParties);
    }

    static getVerifiedThirdPartyLocRequests(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/verified-third-party-loc-requests"].get!;
        operationObject.summary = "Lists the LOC requests a Verified Trusted Parties has been selected for";
        operationObject.description = "The authenticated user must be a Verified Trusted Party.";
        operationObject.responses = getDefaultResponses("FetchLocRequestsResponseView");
    }

    @HttpGet("/verified-third-party-loc-requests")
    @Async()
    async getVerifiedThirdPartyLocRequests(): Promise<FetchLocRequestsResponseView> {
        const userCheck = await this.authenticationService.authenticatedUser(this.request);
        let identityLocs = await this.locRequestRepository.findBy({
            expectedRequesterAddress: userCheck.address,
            expectedLocTypes: [ "Identity" ],
            expectedStatuses: [ "CLOSED" ],
            isVerifiedThirdParty: true,
        });
        identityLocs = identityLocs.filter(loc => loc.getVoidInfo() === null);

        if(identityLocs.length === 0) {
            throw forbidden("Authenticated user is not a VTP");
        }

        const verifiedThirdPartyLocId = identityLocs[0].id!;
        const selections = await this.verifiedThirdPartySelectionRepository.findBy({
            verifiedThirdPartyLocId,
            selected: true,
        });
        const requests = [];
        for(const selection of selections) {
            const request = await this.locRequestRepository.findById(selection.id.locRequestId);
            if(request) {
                requests.push(await this.locRequestAdapter.toView(request, userCheck.address));
            }
        }
        return { requests };
    }
}
