import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpGet, HttpPut, HttpPost, HttpDelete, SendsResponse } from "dinoloop";
import { OpenAPIV3 } from "express-oas-generator";
import { addTag, AuthenticationService, badRequest, forbidden, getDefaultResponses, getDefaultResponsesNoContent, getRequestBody, Log, requireDefined, setControllerTag, setPathParameters } from "@logion/rest-api-core";
import { components } from "./components";
import { LocRequestAggregateRoot, LocRequestRepository } from "../model/locrequest.model";
import { VerifiedThirdPartyNominationFactory, VerifiedThirdPartyNominationId, VerifiedThirdPartyNominationRepository } from "../model/verifiedthirdpartynomination.model";
import { VerifiedThirdPartyAdapter } from "./adapters/verifiedthirdpartyadapter";
import { NotificationService } from "../services/notification.service";
import { DirectoryService } from "../services/directory.service";

const { logger } = Log;

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Verified Third Parties';
    addTag(spec, {
        name: tagName,
        description: "Handling of Verified Third Parties"
    });
    setControllerTag(spec, /^\/api\/loc-request\/.*\/verified-third-party$/, tagName);
    setControllerTag(spec, /^\/api\/loc-request\/.*\/selected-parties\/.*/, tagName);
    setControllerTag(spec, /^\/api\/verified-third-parties\/.*/, tagName);

    VerifiedThirdPartyController.nominateDismissVerifiedThirdParty(spec);
    VerifiedThirdPartyController.selectVerifiedThirdParty(spec);
    VerifiedThirdPartyController.unselectVerifiedThirdParty(spec);
    VerifiedThirdPartyController.getLegalOfficerVerifiedThirdParties(spec);
}

type SetVerifiedThirdPartyRequest = components["schemas"]["SetVerifiedThirdPartyRequest"];
type SelectVerifiedThirdPartyRequest = components["schemas"]["SelectVerifiedThirdPartyRequest"];
type VerifiedThirdPartiesView = components["schemas"]["VerifiedThirdPartiesView"];

@injectable()
@Controller('')
export class VerifiedThirdPartyController extends ApiController {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private authenticationService: AuthenticationService,
        private verifiedThirdPartyNominationFactory: VerifiedThirdPartyNominationFactory,
        private verifiedThirdPartyNominationRepository: VerifiedThirdPartyNominationRepository,
        private verifiedThirdPartyAdapter: VerifiedThirdPartyAdapter,
        private notificationService: NotificationService,
        private directoryService: DirectoryService,
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
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        const userCheck = await this.authenticationService.authenticatedUser(this.request);
        userCheck.require(user => user.is(request.ownerAddress));

        const nominated = body.isVerifiedThirdParty || false;
        request.setVerifiedThirdParty(nominated);
        await this.locRequestRepository.save(request);

        if(!nominated) {
            await this.verifiedThirdPartyNominationRepository.deleteByVerifiedThirdPartyId(requestId);
        }

        this.notifyVtpNominatedDismissed({
            legalOfficerAddress: userCheck.address,
            nominated,
            vtpEmail: request.getDescription().userIdentity?.email,
        });
        this.response.sendStatus(204);
    }

    private async notifyVtpNominatedDismissed(args: {
        legalOfficerAddress: string,
        nominated: boolean,
        vtpEmail?: string,
    }) {
        const { legalOfficerAddress, nominated, vtpEmail } = args;
        try {
            const legalOfficer = await this.directoryService.get(legalOfficerAddress);
            const data = {
                legalOfficer
            };
            if(nominated) {
                await this.notificationService.notify(vtpEmail, "vtp-nominated", data);
            } else {
                await this.notificationService.notify(vtpEmail, "vtp-dismissed", data);
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
            const nomination = await this.verifiedThirdPartyNominationFactory.newNomination({
                verifiedThirdPartyLocRequest,
                locRequest,
            });
            await this.verifiedThirdPartyNominationRepository.save(nomination);
        } catch(e) {
            throw badRequest((e as Error).message);
        }

        this.notifyVtpSelectedUnselected({
            legalOfficerAddress: userCheck.address,
            selected: true,
            locRequest,
            vtpEmail: verifiedThirdPartyLocRequest.getDescription().userIdentity?.email,
        });

        this.response.sendStatus(204);
    }

    private async notifyVtpSelectedUnselected(args: {
        legalOfficerAddress: string,
        selected: boolean,
        locRequest: LocRequestAggregateRoot,
        vtpEmail?: string,
    }) {
        const { legalOfficerAddress, selected, locRequest, vtpEmail } = args;
        try {
            const legalOfficer = await this.directoryService.get(legalOfficerAddress);
            const data = {
                legalOfficer,
                loc: {
                    ...locRequest.getDescription(),
                    id: locRequest.id,
                }
            };
            if(selected) {
                await this.notificationService.notify(vtpEmail, "vtp-selected", data);
            } else {
                await this.notificationService.notify(vtpEmail, "vtp-unselected", data);
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

        const nominationId: VerifiedThirdPartyNominationId = {
            locRequestId: requestId,
            verifiedThirdPartyLocId: partyId,
        };
        await this.verifiedThirdPartyNominationRepository.deleteById(nominationId);

        const verifiedThirdPartyLocRequest = requireDefined(await this.locRequestRepository.findById(partyId));
        this.notifyVtpSelectedUnselected({
            legalOfficerAddress: userCheck.address,
            selected: false,
            locRequest,
            vtpEmail: verifiedThirdPartyLocRequest.getDescription().userIdentity?.email,
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
}
