import { injectable } from 'inversify';
import { ApiController, Controller, HttpPut, Async } from 'dinoloop';
import { OpenAPIV3 } from 'express-oas-generator';
import {
    addTag,
    setControllerTag,
    getRequestBody,
    getDefaultResponses,
    PolkadotService,
    requireDefined
} from '@logion/rest-api-core';

import { components } from './components.js';
import { TransactionRepository, TransactionAggregateRoot } from "../model/transaction.model.js";
import { toFeesView } from './adapters/locrequestadapter.js';
import { Lgnt, ValidAccountId } from "@logion/node-api";

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Transactions';
    addTag(spec, {
        name: tagName,
        description: "Handling of Transactions"
    });
    setControllerTag(spec, /^\/api\/transaction.*/, tagName);

    TransactionController.fetchTransactions(spec);
}

type TransactionView = components["schemas"]["TransactionView"];
type FetchTransactionsSpecificationView = components["schemas"]["FetchTransactionsSpecificationView"];
type FetchTransactionsResponseView = components["schemas"]["FetchTransactionsResponseView"];

@injectable()
@Controller('/transaction')
export class TransactionController extends ApiController {

    constructor(
        private transactionRepository: TransactionRepository,
        private polkadotService: PolkadotService,
    ) {
        super();
    }

    static fetchTransactions(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/transaction"].put!;
        operationObject.summary = "Lists Transactions based on a given specification";
        operationObject.description = "The authenticated user must be participant (from/to) of the expected transactions";
        operationObject.requestBody = getRequestBody({
            description: "The specifications for the expected transactions",
            view: "FetchTransactionsSpecificationView",
        });
        operationObject.responses = getDefaultResponses("FetchTransactionsResponseView");
    }

    @Async()
    @HttpPut('')
    async fetchTransactions(body: FetchTransactionsSpecificationView): Promise<FetchTransactionsResponseView> {
        const logion = await this.polkadotService.readyApi();
        const account = ValidAccountId.polkadot(requireDefined(body.address));
        const transactions = await this.transactionRepository.findBy({
            account,
            chainType: logion.chainType,
        });
        return {
            transactions: transactions.map(this.toView)
        }
    }

    private toView(transaction: TransactionAggregateRoot): TransactionView {
        const description = transaction.getDescription();
        const successful = description.error === undefined;
        let total =
            description.fees.totalFee
                .add(Lgnt.fromCanonical(description.tip))
                .add(Lgnt.fromCanonical(description.reserved));
        if (successful) {
            total = total.add(Lgnt.fromCanonical(description.transferValue));
        }
        return {
            id: description.id,
            from: description.from.address,
            to: description.to?.address || undefined,
            createdOn: description.createdOn,
            pallet: description.pallet,
            method: description.method,
            transferValue: description.transferValue.toString(),
            tip: description.tip.toString(),
            fees: toFeesView(description.fees),
            reserved: description.reserved.toString(),
            total: total.toString(),
            successful,
            error: description.error,
            type: description.type,
        }
    }
}
