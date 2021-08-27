import { IExtrinsic } from './Extrinsic';

export interface IBlock {
    number: bigint;
    extrinsics: IExtrinsic[];
}
