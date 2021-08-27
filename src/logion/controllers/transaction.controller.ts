import { injectable } from 'inversify';
import { ApiController, Controller, HttpPost, HttpPut, Async, BadRequestException } from 'dinoloop';
import { v4 as uuid } from 'uuid';
import moment from 'moment';
import { OpenAPIV3 } from 'express-oas-generator';

import {
    ProtectionRequestRepository,
    FetchProtectionRequestsSpecification,
    ProtectionRequestAggregateRoot,
    ProtectionRequestFactory,
} from '../model/protectionrequest.model';

import { components } from './components';

import { RecoveryService } from '../services/recovery.service';
import { addTag, setControllerTag, getRequestBody, getDefaultResponses, addPathParameter } from './doc';
import { SignatureService } from '../services/signature.service';
import { requireDefined } from '../lib/assertions';

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Transactions';
    addTag(spec, {
        name: tagName,
        description: "Handling of Transactions"
    });
    setControllerTag(spec, /^\/api\/transaction.*/, tagName);

    TransactionController.fetchTransactions(spec);
}

type FetchTransactionsSpecificationView = components["schemas"]["FetchTransactionsSpecificationView"];
type FetchTransactionsResponseView = components["schemas"]["FetchTransactionsResponseView"];

@injectable()
@Controller('/transaction')
export class TransactionController extends ApiController {

    constructor() {
        super();
    }

    static fetchTransactions(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/transaction"].put!;
        operationObject.summary = "Lists Transactions based on a given specification";
        operationObject.description = "No authentication required yet";
        operationObject.requestBody = getRequestBody({
            description: "The specifications for the expected transactions",
            view: "FetchTransactionsSpecificationView",
        });
        operationObject.responses = getDefaultResponses("FetchTransactionsResponseView");
    }

    @Async()
    @HttpPut('')
    async fetchTransactions(body: FetchTransactionsSpecificationView): Promise<FetchTransactionsResponseView> {
        return {
            transactions: []
        }
    }
}
