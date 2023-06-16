import crypto, { BinaryToTextEncoding } from 'crypto';
import fs from 'fs';
import Stream from 'stream';
import { Hash } from "@logion/node-api";

const algorithm = "sha256";

export { Hash };

export function sha256(attributes: any[]): string {
    return hash(algorithm, attributes);
}

export function sha256String(message: string): Hash {
    return `0x${ hash(algorithm, [ message ], "hex") }`;
}

function hash(algorithm: string, attributes: any[], encoding: BinaryToTextEncoding = "base64"): string {
    const hash = crypto.createHash(algorithm);
    attributes.forEach(attribute => hash.update(Buffer.from(attribute.toString(), 'utf8')));
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
            success(`0x${ hash.digest('hex') }`);
        });
        stream.on('error', error);
    });
    stream.pipe(hasherStream);
    return promise;
}
