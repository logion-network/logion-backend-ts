import moment from 'moment';
import { It, Mock } from 'moq.ts';

import { TransactionAggregateRoot, TransactionFactory, TransactionRepository } from '../../../src/logion/model/transaction.model';
import { BlockExtrinsics } from '../../../src/logion/services/types/responses/Block';
import { TransactionExtractor } from '../../../src/logion/services/transaction.extractor';
import { TransactionSynchronizer } from "../../../src/logion/services/transactionsync.service";
import { Transaction, BlockWithTransactionsBuilder } from "../../../src/logion/services/transaction.vo";
import { NonTransactionalTransactionService } from '../../../src/logion/services/transaction.service';

describe("TransactionSync", () => {

    beforeEach(() => {
        transactionRepository = new Mock<TransactionRepository>();
        transactionFactory = new Mock<TransactionFactory>();
        transactionExtractor = new Mock<TransactionExtractor>();
    });

    let transactionRepository: Mock<TransactionRepository>;
    let transactionFactory: Mock<TransactionFactory>;
    let transactionExtractor: Mock<TransactionExtractor>;

    function transactionSync(): TransactionSynchronizer {
        return new TransactionSynchronizer(
            transactionFactory.object(),
            transactionExtractor.object(),
            new NonTransactionalTransactionService(transactionRepository.object()),
        );
    }

    it("adds new transactions", async () => {
        // Given
        const block = new Mock<BlockExtrinsics>();
        const transaction = new Mock<Transaction>();
        const transactions = [ transaction.object() ];
        const blockWithTransaction = new BlockWithTransactionsBuilder()
                .timestamp(moment())
                .blockNumber(42n)
                .transactions(transactions)
                .build();
        transactionExtractor.setup(instance => instance.extractBlockWithTransactions(block.object()))
            .returns(Promise.resolve(blockWithTransaction));

        const transactionAggregate = new Mock<TransactionAggregateRoot>();
        transactionFactory.setup(instance => instance.newTransaction(It.IsAny()))
            .returns(transactionAggregate.object());
        transactionRepository.setup(instance => instance.save(transactionAggregate.object()))
            .returns(Promise.resolve());

        // When
        await transactionSync().addTransactions(block.object());

        // Then
        transactionExtractor.verify(instance => instance.extractBlockWithTransactions(block.object()));
        transactionFactory.verify(instance => instance.newTransaction(It.IsAny()));
        transactionRepository.verify(instance => instance.save(transactionAggregate.object()));
    });
});
