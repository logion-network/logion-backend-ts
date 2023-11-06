import crypto, { BinaryToTextEncoding } from 'crypto';
import fs from 'fs';
import Stream from 'stream';
import { Hash } from "@logion/node-api";
import { ValueTransformer } from "typeorm/decorator/options/ValueTransformer";

const algorithm = "sha256";

export { Hash };

export class HashTransformer implements ValueTransformer {

    public static readonly instance = new HashTransformer();

    from(value: Buffer | undefined): Hash | undefined {
        if (!value) {
            return undefined;
        }
        return new Hash(value);
    }

    to(value: Hash): Buffer {
        return Buffer.from(value.bytes);
    }
}

export function sha256(attributes: string[]): string {
    return hash(algorithm, attributes);
}

function hash(algorithm: string, attributes: string[], encoding: BinaryToTextEncoding = "base64"): string {
    const hash = crypto.createHash(algorithm);
    attributes.forEach(attribute => hash.update(Buffer.from(attribute, 'utf8')));
    return hash.digest(encoding);
}

export function sha256File(fileName: string): Promise<Hash> {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(fileName);
    const hasherStream = new Stream.Writable();
    hasherStream._write = (chunk, _encoding, next) => {
        hash.update(chunk);
        next();
    }
    const promise = new Promise<Hash>((success, error) => {
        stream.on('end', function () {
            success(Hash.fromHex(`0x${ hash.digest('hex') }`));
        });
        stream.on('error', error);
    });
    stream.pipe(hasherStream);
    return promise;
}
