import { injectable } from "inversify";
import { expandMetadata } from '@polkadot/types';
import {
    Block,
    Hash,
    BlockHash,
    BlockWeights
} from '@polkadot/types/interfaces';
import { CalcFee } from '@substrate/calc';

import { PolkadotService } from "./polkadot.service";

@injectable()
export class FeesService {

    constructor( private polkadotService: PolkadotService ) {}

    private weightPerSpecCache: WeightPerSpec = {};

    public async buildFeesCalculator(
        block: Block
    ): Promise<FeesCalculator> {
        const { specName, specVersion } = await this.getBlockRuntimeVersion(block);
        const parentHash = block.header.parentHash;
        const api = await this.polkadotService.readyApi();
        const multiplier = await api.query.transactionPayment?.nextFeeMultiplier?.at(parentHash);
        const perByte = api.consts.transactionPayment?.transactionByteFee;
        const extrinsicBaseWeightExists = api.consts.system.blockWeights.perClass.normal.baseExtrinsic;
        const { weightToFee } = api.consts.transactionPayment;

        if (!perByte || !extrinsicBaseWeightExists || !multiplier || !weightToFee) {
            throw new Error("Unsupported runtime");
        }

        const coefficients = weightToFee.map((c) => {
            return {
                coeffInteger: c.coeffInteger.toString(10),
                coeffFrac: c.coeffFrac.toNumber(),
                degree: c.degree.toNumber(),
                negative: c.negative,
            };
        });

        const calcFee = CalcFee.from_params(
            coefficients,
            multiplier.toString(10),
            perByte.toString(10),
            specName,
            specVersion
        );
        if (calcFee === null || calcFee === undefined) {
            throw new Error(`Fee calculation not supported for ${specVersion}#${specName}`);
        }

        this.weightPerSpecCache[specVersion] ||= await this.getBaseWeightValue(parentHash);

        return new FeesCalculator({
            calcFee,
            specName,
            specVersion,
            weightValue: this.weightPerSpecCache[specVersion]
        });
    }

    private async getBlockRuntimeVersion(
        block: Block
    ): Promise<{specName: string, specVersion: number}> {
        const parentHash = block.header.parentHash;
        const api = await this.polkadotService.readyApi();
        const parentParentHash: Hash = await this.getParentParentHashIfPresent(parentHash, block);
        const version = await api.rpc.state.getRuntimeVersion(parentParentHash);
        return {
            specName: version.specName.toString(),
            specVersion: version.specVersion.toNumber()
        }
    }

    private async getParentParentHashIfPresent(
        parentHash: Hash,
        block: Block
    ): Promise<Hash> {
        const api = await this.polkadotService.readyApi();
        let parentParentHash: Hash;
        if (block.header.number.toNumber() > 1) {
            parentParentHash = (await api.rpc.chain.getHeader(parentHash)).parentHash;
        } else {
            parentParentHash = parentHash;
        }
        return parentParentHash;
    }

    private async getBaseWeightValue(
        blockHash: BlockHash
    ): Promise<WeightValue> {
        const api = await this.polkadotService.readyApi();
        const metadata = await api.rpc.state.getMetadata(blockHash);
        const {
            consts: { system },
        } = expandMetadata(api.registry, metadata);

        const { normal, operational, mandatory } = (system.blockWeights as unknown as BlockWeights)?.perClass;

        return {
            normal: {
                baseExtrinsic: normal.baseExtrinsic.toBigInt(),
            },
            operational: {
                baseExtrinsic: operational.baseExtrinsic.toBigInt(),
            },
            mandatory: {
                baseExtrinsic: mandatory.baseExtrinsic.toBigInt(),
            },
        };
    }
}

export class FeesCalculator {

    constructor(params: {
        calcFee?: CalcFee,
        specName: string,
        specVersion: number,
        weightValue: WeightValue,
    }) {
        this.calcFee = params.calcFee;
        this.specName = params.specName;
        this.specVersion = params.specVersion;
        this.weightValue = params.weightValue;
    }

    private calcFee?: CalcFee;
    readonly specName: string;
    readonly specVersion: number;
    private weightValue: WeightValue;

    public async getPartialFees(
        weightInfo: WeightInfo,
        encodedLength: number,
    ): Promise<BigInt> {
        const extrinsicBaseWeight = await this.getBaseWeight(weightInfo);
        const weight = weightInfo.weight;

        const partialFee = this.calcFee!.calc_fee(
            BigInt(weight.toString()),
            encodedLength,
            extrinsicBaseWeight
        );

        return BigInt(partialFee);
    }

    private async getBaseWeight(
        weightInfo: WeightInfo,
    ): Promise<BigInt> {
        if (weightInfo.class === 'Normal') {
            return this.weightValue.normal.baseExtrinsic;
        } else if (weightInfo.class === 'Mandatory') {
            return this.weightValue.mandatory.baseExtrinsic;
        } else if (weightInfo.class === 'Operational') {
            return this.weightValue.operational.baseExtrinsic;
        } else {
            throw new Error('Unexpected weight value');
        }
    }
}

type WeightPerSpec = Record<number, WeightValue>;

interface WeightValue {
    normal: IWeightPerClass;
    mandatory: IWeightPerClass;
    operational: IWeightPerClass;
}

interface IWeightPerClass {
    baseExtrinsic: BigInt;
}

export interface WeightInfo {
    'class': 'Normal' | 'Mandatory' | 'Operational';
    weight: number | string | bigint | BigInt;
}
