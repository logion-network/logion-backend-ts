import { injectable, unmanaged } from 'inversify';
import { sha256 } from '../lib/crypto/hashing';
import { signatureVerify } from "@polkadot/util-crypto";
import { waitReady } from "@polkadot/wasm-crypto";
import { recoverAddress } from "@ethersproject/transactions";
import { toHex } from "@logion/node-api/dist/Codec";
import { sha3 } from "web3-utils";

export interface VerifyParams {
    signature: string;
    address: string;
    resource: string;
    operation: string;
    timestamp: string;
    attributes: any[];
}

export interface VerifyFunctionParams {
    signature: string;
    address: string;
    message: string;
}

export type VerifyFunction = (params: VerifyFunctionParams) => Promise<boolean>;

@injectable()
export class SignatureService {

    private readonly verifier: VerifyFunction;

    constructor(@unmanaged() verifier: VerifyFunction) {
        this.verifier = verifier;
    }

    buildMessage(params: VerifyParams): string {
        const allAttributes = [
            params.resource,
            params.operation,
            this.sanitizeDateTime(params.timestamp)
        ];
        params.attributes.forEach(attribute => this.pushOrExpand(allAttributes, attribute));
        return sha256(allAttributes);
    }

    async verify(params: VerifyParams): Promise<boolean> {
        const message = this.buildMessage(params);

        const {
            address,
            signature,
        } = params;

        return this.verifier({ message, signature, address })
    }

    private sanitizeDateTime(dateTime: string): string {
        if (dateTime.endsWith("Z")) {
            return dateTime.substring(0, dateTime.length - 1);
        } else {
            return dateTime;
        }
    }

    private pushOrExpand(allAttributes: any[], attribute: any) {
        if (Array.isArray(attribute)) {
            attribute.forEach(subAttribute => this.pushOrExpand(allAttributes, subAttribute));
        } else {
            allAttributes.push(attribute);
        }
    }
}

@injectable()
export class PolkadotSignatureService extends SignatureService {

    constructor() {
        super(PolkadotSignatureService.verify);
    }

    private static async verify(params: VerifyFunctionParams): Promise<boolean> {
        await waitReady();
        const message = `<Bytes>${ params.message }</Bytes>`;
        return signatureVerify(message, params.signature, params.address).isValid;
    }
}

@injectable()
export class EthereumSignatureService extends SignatureService {

    constructor() {
        super(EthereumSignatureService.verify);
    }

    private static async verify(params: VerifyFunctionParams): Promise<boolean> {
        const { message, signature, address } = params;
        // sha3 must be applied when using Polkadot extension MetaMask compatibility layer
        // @see https://github.com/polkadot-js/extension/blob/master/packages/extension-compat-metamask/src/bundle.ts#L80
        const digest = sha3(toHex(message))!;
        const recoveredAddress = recoverAddress(digest, signature);
        return Promise.resolve(recoveredAddress.toLowerCase() === address.toLowerCase());
    }
}

