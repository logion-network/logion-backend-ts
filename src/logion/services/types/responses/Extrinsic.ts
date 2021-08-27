export interface ExtrinsicInfo {
    partialFee?: string;
    error?: string;
}

export interface ISanitizedArgs {
    [key: string]: any;
}

export interface IFrameMethod {
    pallet: string;
    method: string;
}

export interface ISanitizedEvent {
    method: IFrameMethod;
    data: string[];
}

export interface IExtrinsic {
    method: IFrameMethod;
    signature: ISignature | null;
    args: ISanitizedArgs;
    tip: string | null;
    info: ExtrinsicInfo;
    events: ISanitizedEvent[];
    success: boolean;
    paysFee: boolean;
}

export interface ISignature {
    signer: string;
}
