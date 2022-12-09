import { JsonExtrinsic } from './Extrinsic.js';

export interface BlockExtrinsics {
    number: bigint;
    extrinsics: JsonExtrinsic[];
}
