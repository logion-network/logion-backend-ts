import crypto from 'crypto';
import fs from 'fs';
import Stream from 'stream';

export function sha256(attributes: any[]): string {
    return hash("sha256", attributes);
}

function hash(algorithm: string, attributes: any[]): string {
    var hash = crypto.createHash(algorithm);
    attributes.forEach(attribute => hash.update(Buffer.from(attribute.toString(), 'utf8')));
    return hash.digest('base64');
}

export function sha256File(fileName: string): Promise<string> {
    var hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(fileName, "binary");
    const hasherStream = new Stream.Writable();
    hasherStream._write = (chunk, _encoding, next) => {
      hash.update(chunk);
      next();
    }
    const promise = new Promise<string>((success, error) => {
        stream.on('end', function() {
            success("0x" + hash.digest('hex'));
        });
        stream.on('error', error);
    });
    stream.pipe(hasherStream);
    return promise;
}
