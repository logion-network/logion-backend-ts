// TODO: To be removed once Fees is available in @logion/node-api
export class Fees {

    constructor(inclusionFee: bigint, storageFee?: bigint) {
        this.inclusionFee = inclusionFee;
        this.storageFee = storageFee;
    }

    readonly inclusionFee: bigint;
    readonly storageFee?: bigint;

    get totalFee(): bigint {
        return this.inclusionFee + (this.storageFee || 0n);
    }
}
