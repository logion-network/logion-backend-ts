import { ChainType } from '@logion/node-api';
import { JsonExtrinsic } from './Extrinsic.js';

export interface BlockExtrinsics {
    number: bigint;
    chain: ChainType;
    extrinsics: JsonExtrinsic[];
}
