import { JsonExtrinsic } from './Extrinsic';

export interface BlockExtrinsics {
    number: bigint;
    extrinsics: JsonExtrinsic[];
}
