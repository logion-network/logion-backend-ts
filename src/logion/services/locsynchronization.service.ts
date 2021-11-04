import { injectable } from 'inversify';
import { LocRequestAggregateRoot, LocRequestRepository } from '../model/locrequest.model';
import { ExtrinsicDataExtractor } from "../services/extrinsic.data.extractor";
import { decimalToUuid } from '../lib/uuid';

import { BlockExtrinsics } from './types/responses/Block';
import { JsonArgs } from './call';

@injectable()
export class LocSynchronizer {

    constructor(
        private extrinsicDataExtractor: ExtrinsicDataExtractor,
        private locRequestRepository: LocRequestRepository,
    ) {}

    async updateLocRequests(block: BlockExtrinsics): Promise<void> {
        const timestamp = this.extrinsicDataExtractor.getBlockTimestamp(block);
        if(timestamp === undefined) {
            throw Error("Block has no timestamp");
        }
        for(let i = 0; i < block.extrinsics.length; ++i) {
            const extrinsic = block.extrinsics[i];
            if(extrinsic.method.pallet === "logionLoc") {
                 if(extrinsic.method.method === "createLoc") {
                    const locId = this.extractLocId(extrinsic.args);
                    this.mutateLoc(locId, loc => loc.setLocCreatedDate(timestamp));
                } else if(extrinsic.method.method === "addMetadata") {
                    const locId = this.extractLocId(extrinsic.args);
                    const item = {
                        name: extrinsic.args['item'].name.toUtf8(),
                        value: extrinsic.args['item'].value.toUtf8(),
                        addedOn: timestamp,
                    };
                    this.mutateLoc(locId, loc => loc.addMetadataItem(item));
                } else if(extrinsic.method.method === "addFile") {
                    const locId = this.extractLocId(extrinsic.args);
                    const hash = extrinsic.args['file'].hash.toHex();
                    this.mutateLoc(locId, loc => loc.setFileAddedOn(hash, timestamp));
                } else if(extrinsic.method.method === "addLink") {
                    const locId = this.extractLocId(extrinsic.args);
                    const link = {
                        target: decimalToUuid(extrinsic.args['link'].id.toString()),
                        addedOn: timestamp,
                    };
                    this.mutateLoc(locId, loc => loc.addLink(link));
                } else if(extrinsic.method.method === "close") {
                    const locId = this.extractLocId(extrinsic.args);
                    this.mutateLoc(locId, loc => loc.close(timestamp));
                }
            }
        }
    }

    private extractLocId(args: JsonArgs): string {
        return decimalToUuid(args['loc_id'].toString());
    }

    private async mutateLoc(locId: string, mutator: (loc: LocRequestAggregateRoot) => void) {
        const loc = await this.locRequestRepository.findById(locId);
        if(loc !== undefined) {
            mutator(loc);
            await this.locRequestRepository.save(loc);
        }
    }
}
