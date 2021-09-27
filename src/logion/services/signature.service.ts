import { injectable } from 'inversify';
import { sha256 } from '../lib/crypto/hashing';
import { signatureVerify } from "@polkadot/util-crypto";
import { waitReady } from "@polkadot/wasm-crypto";

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

    private verifier: VerifyFunction;

    constructor() {
        this.verifier = async (params: VerifyFunctionParams) => {
            await waitReady();
            return signatureVerify(params.message, params.signature, params.address).isValid;
        }
    }

    static of(verifier: VerifyFunction): SignatureService {
        const signatureService = new SignatureService();
        signatureService.verifier = verifier;
        return signatureService;
    }

    async verify(params: VerifyParams): Promise<boolean> {
        const allAttributes = [
            params.resource,
            params.operation,
            this.sanitizeDateTime(params.timestamp)
        ];
        params.attributes.forEach(attribute => this.pushOrExpand(allAttributes, attribute));
        const hash = sha256(allAttributes);
        const message = `<Bytes>${ hash }</Bytes>`;

        const {
            address,
            signature,
        } = params;

        return this.verifier({ message, signature, address })
    }

    private sanitizeDateTime(dateTime: string): string {
        if(dateTime.endsWith("Z")) {
            return dateTime.substring(0, dateTime.length - 1);
        } else {
            return dateTime;
        }
    }

    private pushOrExpand(allAttributes: any[], attribute: any) {
        if(Array.isArray(attribute)) {
            attribute.forEach(subAttribute => this.pushOrExpand(allAttributes, subAttribute));
        } else {
            allAttributes.push(attribute);
        }
    }
}
