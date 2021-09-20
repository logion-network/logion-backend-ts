import { injectable } from "inversify";
import { Controller, ApiController, HttpPost, Async, HttpPut } from "dinoloop";
import { components } from "./components";
import { v4 as uuid } from "uuid";
import moment from "moment";
import { LocRequestStatus } from "../model/locrequest.model";
import { ALICE, BOB } from "../model/addresses.model";
import { OpenAPIV3 } from "express-oas-generator";
import { getRequestBody, getDefaultResponses, addTag, setControllerTag } from "./doc";

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'LOC Requests';
    addTag(spec, {
        name: tagName,
        description: "Handling of LOC Requests"
    });
    setControllerTag(spec, /^\/api\/loc-request.*/, tagName);

    LocRequestController.createLocRequest(spec);
    LocRequestController.fetchRequests(spec);
}

type CreateLocRequestView = components["schemas"]["CreateLocRequestView"];
type LocRequestView = components["schemas"]["LocRequestView"];
type FetchLocRequestsSpecificationView = components["schemas"]["FetchLocRequestsSpecificationView"];
type FetchLocRequestsResponseView = components["schemas"]["FetchLocRequestsResponseView"];

@injectable()
@Controller('/loc-request')
export class LocRequestController extends ApiController {

    static createLocRequest(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request"].post!;
        operationObject.summary = "Creates a new LOC Request";
        operationObject.description = "The authenticated user must be the requester. No signature required";
        operationObject.requestBody = getRequestBody({
            description: "LOC Request creation data",
            view: "CreateLocRequestView",
        });
        operationObject.responses = getDefaultResponses("LocRequestView");
    }

    @HttpPost('')
    @Async()
    async createLocRequest(createLocRequestView: CreateLocRequestView): Promise<LocRequestView> {
        return this.fake(createLocRequestView, "PENDING");
    }

    private fake(createLocRequestView: CreateLocRequestView, status: LocRequestStatus): LocRequestView {
        return {
            description: createLocRequestView.description,
            requesterAddress: createLocRequestView.requesterAddress,
            ownerAddress: createLocRequestView.ownerAddress,
            id: uuid(),
            createdOn: moment().toISOString(),
            status
        }
    }

    static fetchRequests(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/loc-request"].put!;
        operationObject.summary = "Lists LOC Requests based on a given specification";
        operationObject.description = "The authenticated user must be either expected requester or expected owner.";
        operationObject.requestBody = getRequestBody({
            description: "The specification for fetching LOC Requests",
            view: "FetchLocRequestsSpecificationView",
        });
        operationObject.responses = getDefaultResponses("FetchLocRequestsResponseView");
    }

    @HttpPut('')
    @Async()
    async fetchRequests(specificationView: FetchLocRequestsSpecificationView): Promise<FetchLocRequestsResponseView> {
        const statuses = specificationView.statuses;
        const status0:LocRequestStatus = statuses && statuses.length > 0 ? statuses[0] : "PENDING";
        const fake1 = this.fake({
            description: "some description of request 1",
            ownerAddress: specificationView.ownerAddress || ALICE,
            requesterAddress: specificationView.requesterAddress || "5Eec8bb2sZZWUoHjf3N3mhpszL93DJVwHkG1PqHtsLqhecm6"
        }, status0);
        const fake2 = this.fake({
            description: "some description of request 2",
            ownerAddress: specificationView.ownerAddress || BOB,
            requesterAddress: specificationView.requesterAddress || "5Eec8bb2sZZWUoHjf3N3mhpszL93DJVwHkG1PqHtsLqhecm6"
        }, (statuses && statuses.length > 1 ? statuses[1] : status0))
        return {
            requests: [ fake1, fake2 ]
        }
    }
}
