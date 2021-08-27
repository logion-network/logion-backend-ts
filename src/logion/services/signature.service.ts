import { injectable } from 'inversify';
import { sha256 } from '../lib/crypto/hashing';
import { SubkeyService } from './subkey.service';

export interface VerifyParams {
    signature: string;
    address: string;
    resource: string;
    operation: string;
    timestamp: string;
    attributes: any[];
}

@injectable()
export class SignatureService {

    constructor(private subkeyService: SubkeyService) {}

    verify(params: VerifyParams): Promise<boolean> {
        const allAttributes = [
            params.resource,
            params.operation,
            this.sanitizeDateTime(params.timestamp)
        ];
        params.attributes.forEach(attribute => this.pushOrExpand(allAttributes, attribute));
        const message = sha256(allAttributes);

        const {
            address,
            signature,
        } = params;
        return this.subkeyService.verify({
            address,
            signature,
            message,
        });
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
