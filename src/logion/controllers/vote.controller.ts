import { ApiController, Controller, Async, HttpGet } from "dinoloop";
import { injectable } from "inversify";
import { components } from "./components";
import { OpenAPIV3 } from "express-oas-generator";
import {
    setPathParameters,
    addTag,
    setControllerTag,
    getDefaultResponses
} from "@logion/rest-api-core";

type FetchVotesResponseView = components["schemas"]["FetchVotesResponseView"];

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Votes';
    addTag(spec, {
        name: tagName,
        description: "Handling of Legal Officer Votes"
    });
    setControllerTag(spec, /^\/api\/vote.*/, tagName);

    VoteController.fetchVotes(spec);
}

@injectable()
@Controller('/vote')
export class VoteController extends ApiController {

    static fetchVotes(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/vote/{legalOfficerAddress}"].get!;
        operationObject.summary = "Lists all Legal Officer's votes";
        operationObject.description = "The authenticated user must be a LO attached to the node.";
        operationObject.responses = getDefaultResponses("FetchVotesResponseView");
        setPathParameters(operationObject, {
            legalOfficerAddress: "The address of the LO"
        });
    }

    @Async()
    @HttpGet('/:legalOfficerAddress')
    async fetchVotes(_body: never, _legalOfficerAddress: string): Promise<FetchVotesResponseView> {
        return {
            votes: []
        }
    }
}
