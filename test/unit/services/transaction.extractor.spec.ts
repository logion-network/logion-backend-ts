import { readFileSync } from 'fs';
import { BlockExtrinsics } from "../../../src/logion/services/types/responses/Block";
import { TransactionExtractor } from "../../../src/logion/sync/transaction.extractor";
import { ExtrinsicDataExtractor } from "../../../src/logion/services/extrinsic.data.extractor";

let transactionExtractor: TransactionExtractor;

beforeAll(() => {
    let extrinsicDataExtractor = new ExtrinsicDataExtractor();
    transactionExtractor = new TransactionExtractor(extrinsicDataExtractor);
})

describe("TransactionExtractor", () => {

    it('does not find transaction in empty block', () => {
        const block = givenBlock("block-empty.json");
        expect(transactionExtractor.extractBlockWithTransactions(block)).toBeUndefined();
    });

    it('finds recovery.createRecovery transactions', () => {
        const params = recoveryParams({
            fileName: "recovery/block-01-recovery-createRecovery.json",
            method: "createRecovery",
            blockNumber: 119261n,
            fee: 125000178n,
            reserved: 12n,
            from: "5CSbpCKSTvZefZYddesUQ9w6NDye2PHbf12MwBZGBgzGeGoo",
        });
        expectTransaction(params);
    });

    it('finds recovery.initiateRecovery transactions', () => {
        const params = recoveryParams({
            fileName: "recovery/block-02-recovery-initiateRecovery.json",
            method: "initiateRecovery",
            blockNumber: 119459n,
            fee: 125000139n,
            reserved: 10n,
            from: "5DPPdRwkgigKt2L7jxRfAoV4tfS89KgXsx47Wk3Kat5K6xPg",
        });
        expectTransaction(params);
    });

    it('finds recovery.vouchRecovery transactions', () => {
        const params = recoveryParams({
            fileName: "recovery/block-03-recovery-vouchRecovery.json",
            method: "vouchRecovery",
            blockNumber: 119506n,
            fee: 125000171n,
            reserved: 0n,
            from: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        });
        expectTransaction(params);
    });

    it('finds recovery.claimRecovery transactions', () => {
        const params = recoveryParams({
            fileName: "recovery/block-05-recovery-claimRecovery.json",
            method: "claimRecovery",
            blockNumber: 119581n,
            fee: 125000139n,
            reserved: 0n,
            from: "5DPPdRwkgigKt2L7jxRfAoV4tfS89KgXsx47Wk3Kat5K6xPg",
        });
        expectTransaction(params);
    });

    it('finds recovery.asRecovered transactions', () => {
        const params = recoveryParams({
            fileName: "recovery/block-06-recovery-asRecovered.json",
            method: "asRecovered",
            blockNumber: 3388n,
            fee: 125000192n,
            reserved: 0n,
            from: "5EBxoSssqNo23FvsDeUxjyQScnfEiGxJaNwuwqBH2Twe35BX",
        });
        expectTransaction(params);
    });

    it('finds assets.create transactions', () => {
        const params = assetsParams({
            fileName: "token/block-01-assets-create.json",
            method: "create",
            blockNumber: 28552n,
            fee: 125000169n,
            reserved: 11n,
            from: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        });
        expectTransaction(params);
    });

    it('finds assets.setMetadata transactions', () => {
        const params = assetsParams({
            fileName: "token/block-02-assets-setMetadata.json",
            method: "setMetadata",
            blockNumber: 28570n,
            fee: 125000141n,
            reserved: 23n,
            from: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        });
        expectTransaction(params);
    });

    it('finds assets.mint transactions', () => {
        const params = assetsParams({
            fileName: "token/block-03-assets-mint.json",
            method: "mint",
            blockNumber: 28620n,
            fee: 125000158n,
            reserved: 0n,
            from: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        });
        expectTransaction(params);
    });

    it('finds balances.transfer transactions', () => {
        const params = balancesParams({
            fileName: "transfer/block-transfer.json",
            method: "transfer",
            blockNumber: 2223n,
            fee: 125000149n,
            tip: 0n,
            transferValue: 100000000000000000n,
            from: "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy",
            to: "5CSbpCKSTvZefZYddesUQ9w6NDye2PHbf12MwBZGBgzGeGoo",
        });
        expectTransaction(params);
    });

    it('finds balances.transferKeepAlive-tip transactions', () => {
        const params = balancesParams({
            fileName: "transfer/block-transferKeepAlive-tip.json",
            method: "transferKeepAlive",
            blockNumber: 59801n,
            fee: 125000152n,
            tip: 25000000n,
            transferValue: 200000000000000000n,
            from: "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY",
            to: "5CSbpCKSTvZefZYddesUQ9w6NDye2PHbf12MwBZGBgzGeGoo",
        });
        expectTransaction(params);
    });

    it('finds balances.transferKeepAlive transactions', () => {
        const params = balancesParams({
            fileName: "transfer/block-transferKeepAlive.json",
            method: "transferKeepAlive",
            blockNumber: 1593n,
            fee: 125000149n,
            tip: 0n,
            transferValue: 540000000000000000n,
            from: "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy",
            to: "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY",
        });
        expectTransaction(params);
    });

    it('finds balances.transferKeepAlive2 transactions', () => {
        const params = balancesParams({
            fileName: "transfer/block-transferKeepAlive2.json",
            method: "transferKeepAlive",
            blockNumber: 1739n,
            fee: 125000149n,
            tip: 0n,
            transferValue: 200000000000000000n,
            from: "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy",
            to: "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY",
        });
        expectTransaction(params);
    });
})

function givenBlock(fileName: string): BlockExtrinsics {
    const data = readFileSync("test/resources/" + fileName);
    const json = JSON.parse(data.toString());
    json.extrinsics.forEach((extrinsic: any) => {
        const args = extrinsic.args;
        if("dest" in args) {
            args.dest.toJSON = () => args.dest
        }
    });
    return json;
}

function recoveryParams(params: {
    fileName: string,
    method: string,
    blockNumber: bigint,
    fee: bigint,
    reserved: bigint,
    from: string,
}): ExpectTransactionParams {
    return {
        ...params,
        pallet: "recovery",
        tip: 0n,
        transferValue: 0n,
        to: null
    };
}

interface ExpectTransactionParams {
    fileName: string,
    pallet: string,
    method: string,
    blockNumber: bigint,
    fee: bigint,
    reserved: bigint,
    tip: bigint,
    transferValue: bigint,
    from: string,
    to: string | null,
}

function expectTransaction(params: ExpectTransactionParams) {
    const block = givenBlock(params.fileName);
    block.number = BigInt(block.number);
    var blockWithTransactions = transactionExtractor.extractBlockWithTransactions(block)!;
    expect(blockWithTransactions.blockNumber).toBe(params.blockNumber);

    const transaction = blockWithTransactions.transactions[0];
    expect(transaction.extrinsicIndex).toBe(1);
    expect(transaction.pallet).toBe(params.pallet);
    expect(transaction.method).toBe(params.method);
    expect(transaction.fee).toBe(params.fee);
    expect(transaction.reserved).toBe(params.reserved);
    expect(transaction.tip).toBe(params.tip);
    expect(transaction.transferValue).toBe(params.transferValue);
    expect(transaction.from).toBe(params.from);
    expect(transaction.to).toBe(params.to);
}

function assetsParams(params: {
    fileName: string,
    method: string,
    blockNumber: bigint,
    fee: bigint,
    reserved: bigint,
    from: string,
}): ExpectTransactionParams {
    return {
        ...params,
        pallet: "assets",
        tip: 0n,
        transferValue: 0n,
        to: null
    };
}

function balancesParams(params: {
    fileName: string,
    method: string,
    blockNumber: bigint,
    fee: bigint,
    tip: bigint,
    transferValue: bigint,
    from: string,
    to: string,
}): ExpectTransactionParams {
    return {
        ...params,
        pallet: "balances",
        reserved: 0n,
    };
}
