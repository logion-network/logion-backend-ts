import { injectable } from 'inversify';
import { ApiController, Controller, HttpPut, Async } from 'dinoloop';
import { OpenAPIV3 } from 'express-oas-generator';

import { components } from './components';
import { addTag, setControllerTag, getRequestBody, getDefaultResponses } from './doc';
import { TransactionRepository, TransactionAggregateRoot } from "../model/transaction.model";

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
        private transactionRepository: TransactionRepository) {
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
        const transactions = await this.transactionRepository.findByAddress(body.address!)
        return {
            transactions: transactions.map(this.toView)
        }
    }

    private toView(transaction: TransactionAggregateRoot): TransactionView {
        const description = transaction.getDescription();
        const successful = description.error === undefined;
        let total =
            description.fee +
            description.tip +
            description.reserved;
        if (successful) {
            total += description.transferValue ;
        }
        return {
            from: description.from,
            to: description.to || undefined,
            createdOn: description.createdOn,
            pallet: description.pallet,
            method: description.method,
            transferValue: description.transferValue.toString(),
            tip: description.tip.toString(),
            fee: description.fee.toString(),
            reserved: description.reserved.toString(),
            total: total.toString(),
            successful,
            error: description.error
        }
    }
}
