import crypto from 'crypto';

export function sha256(attributes: any[]): string {
    return hash("sha256", attributes);
}

function hash(algorithm: string, attributes: any[]): string {
    var hash = crypto.createHash(algorithm);
    attributes.forEach(attribute => hash.update(Buffer.from(attribute.toString(), 'utf8')));
    return hash.digest('base64');
}
