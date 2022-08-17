import moment, { Moment } from "moment";

/**
 * This interface describes the metadata that are associated to
 * a file provided through restricted delivery.
 */
export interface RestrictedDeliveryMetadata {
    owner: string;
    generatedOn: Moment;
}

const ENCODED_METADATA_HEADER="-----BEGIN LOGION METADATA-----";
const ENCODED_METADATA_FOOTER="-----END LOGION METADATA-----";

/**
 * This class is responsible for converting restricted delivery metadata into
 * a string a vice-versa.
 */
export class RestrictedDeliveryMetadataCodec {

    static encode(metadata: RestrictedDeliveryMetadata): string {
        return `${ENCODED_METADATA_HEADER}
owner=${metadata.owner}
generatedOn=${metadata.generatedOn.toISOString()}
${ENCODED_METADATA_FOOTER}`;
    }

    static decode(encodedMetadata: string): RestrictedDeliveryMetadata {
        if(!encodedMetadata.startsWith(ENCODED_METADATA_HEADER)) {
            throw new Error("Metadata header missing");
        }
        if(!encodedMetadata.endsWith(ENCODED_METADATA_FOOTER)) {
            throw new Error("Metadata footer missing");
        }
        let owner = "";
        let generatedOn = "";
        const lines = encodedMetadata.split("\n");
        for(const line of lines) {
            owner = this.getPropertyValue(line, "owner") || owner;
            generatedOn = this.getPropertyValue(line, "generatedOn") || generatedOn;
        }
        return {
            owner,
            generatedOn: moment(generatedOn),
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

/**
 * This class extracts encoded restricted delivery metadata from plain text and
 * is able to update them.
 */
export class RestrictedDeliveryMetadataUpdater {

    constructor(text: string) {
        this._text = text;
        this.findMetadata();
    }

    private _text: string;

    get text(): string {
        return this._text;
    }

    private findMetadata() {
        this.start = this._text.indexOf(ENCODED_METADATA_HEADER);
        if(this.start !== -1) {
            this.end = this._text.indexOf(ENCODED_METADATA_FOOTER, this.start + ENCODED_METADATA_HEADER.length);
            if(this.end === -1) {
                throw new Error("Invalid metadata");
            }
        }
        if(this.start !== -1 && this.end !== -1) {
            this._metadata = RestrictedDeliveryMetadataCodec.decode(this._text.slice(this.start, this.end + ENCODED_METADATA_FOOTER.length));
        }
    }

    private start = -1;

    private end = -1;

    private _metadata: RestrictedDeliveryMetadata | undefined;

    get metadata(): RestrictedDeliveryMetadata | undefined {
        return this._metadata;
    }

    setMetadata(metadata: RestrictedDeliveryMetadata) {
        const encodedMetadata = RestrictedDeliveryMetadataCodec.encode(metadata);
        let updatedText: string;
        if(this._metadata === undefined) {
            if(this._text.length > 0) {
                updatedText = `${this._text}

${encodedMetadata}
`;

                this.start = this._text.length + 2;
            } else {
                updatedText = encodedMetadata;
                this.start = 0;
            }
        } else {
            const before = this._text.slice(0, this.start);
            const after = this._text.slice(this.end + ENCODED_METADATA_FOOTER.length);

            updatedText = `${before}${encodedMetadata}${after}`;

            this.start = before.length;
        }

        this.end = this.start + encodedMetadata.length - ENCODED_METADATA_FOOTER.length;
        this._metadata = metadata;
        this._text = updatedText;
    }
}
