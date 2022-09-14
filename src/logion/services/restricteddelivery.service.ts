import { NodeSigner } from '@logion/authenticator';
import { KeyObject } from 'crypto';
import { injectable } from 'inversify';
import { Moment } from 'moment';
import PeerId from 'peer-id';

import { ExifService } from './exif.service';
import { RestrictedDeliveryMetadataCodec, RestrictedDeliveryMetadataUpdater } from './RestrictedDeliveryMetadata';

export interface RestrictedDeliveryMetadataWithoutSignature {
    owner: string;
    generatedOn: Moment;
}

@injectable()
export class RestrictedDeliveryService {

    constructor(
        private exifService: ExifService,
    ) {
        if (process.env.JWT_ISSUER === undefined) {
            throw Error("No JWT issuer set, please set var JWT_ISSUER equal to NODE_PEER_ID (base58 encoding)");
        }
        if (process.env.JWT_SECRET === undefined) {
            throw Error("No JWT secret set, please set var JWT_SECRET equal to NODE_SECRET_KEY");
        }
        this.nodeId = PeerId.createFromB58String(process.env.JWT_ISSUER);
        this.nodeSigner = new NodeSigner();
        this.privateKey = this.nodeSigner.buildPrivateJsonWebKey(
            this.nodeId,
            Buffer.from(process.env.JWT_SECRET, "hex")
        );
    }

    private nodeId: PeerId;

    private privateKey: KeyObject;

    private nodeSigner: NodeSigner;

    async setMetadata(args: { file: string, metadata: RestrictedDeliveryMetadataWithoutSignature }): Promise<void> {
        if(await this.exifService.isExifSupported(args.file)) {
            const description = (await this.exifService.readImageDescription(args.file)) || "";
            const updater = new RestrictedDeliveryMetadataUpdater(description);
            updater.setMetadata({
                ...args.metadata,
                nodeId: this.nodeId,
                signature: this.sign(args.metadata),
            });
            await this.exifService.writeImageDescription({ file: args.file, description: updater.text });
        }
    }

    private sign(metadata: RestrictedDeliveryMetadataWithoutSignature): Buffer {
        const data = Buffer.from(RestrictedDeliveryMetadataCodec.encode({
            ...metadata,
            nodeId: this.nodeId,
            signature: Buffer.from(""),
        }));
        return this.nodeSigner.sign(data, this.privateKey);
    }
}
