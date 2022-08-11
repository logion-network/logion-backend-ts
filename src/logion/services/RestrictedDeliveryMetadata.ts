export interface RestrictedDeliveryMetadata {
    owner: string;
}

export class RestrictedDeliveryMetadataCodec {

    static encode(metadata: RestrictedDeliveryMetadata): string {
        return `-----BEGIN LOGION METADATA-----
owner=${metadata.owner}
-----END LOGION METADATA-----`;
    }
    
    static decode(encodedMetadata: string): RestrictedDeliveryMetadata {
        if(!encodedMetadata.startsWith("-----BEGIN LOGION METADATA-----")) {
            throw new Error("Metadata header missing");
        }
        if(!encodedMetadata.endsWith("-----END LOGION METADATA-----")) {
            throw new Error("Metadata footer missing");
        }
        let owner = "";
        const lines = encodedMetadata.split("\n");
        for(const line of lines) {
            owner = this.getPropertyValue(line, "owner") || owner;
        }
        return {
            owner,
        };
    }

    private static getPropertyValue(line: string, name: string): string | undefined {
        const prefix = `${name}=`;
        if(line.startsWith(prefix)) {
            return line.slice(prefix.length);
        } else {
            return undefined;
        }
    }
}
