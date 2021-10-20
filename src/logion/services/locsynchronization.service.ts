import { injectable } from 'inversify';
import { LocRequestAggregateRoot, LocRequestRepository } from '../model/locrequest.model';
import { ExtrinsicDataExtractor } from "../services/extrinsic.data.extractor";
import { Log } from '../util/Log';
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
                } else if(extrinsic.method.method === "addHash") {
                    const locId = this.extractLocId(extrinsic.args);
                    const hash = extrinsic.args['hash'].toHex();
                    this.mutateLoc(locId, loc => loc.setFileAddedOn(hash, timestamp));
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

    async reset() {
        // There seem to be no good approach in this case for LOC requests. Deleting everything is dangerous because
        // LOC requests contain data that cannot be rebuilt from the chain. Altering their state is dangerous as well
        // for the same reason. As a result, this is a no-op and it is up to the ops to decide what to do in this case.
    }
}
