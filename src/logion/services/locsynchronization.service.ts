import { injectable } from 'inversify';
import { LocRequestRepository } from '../model/locrequest.model';
import { ExtrinsicDataExtractor } from "../services/extrinsic.data.extractor";

import { BlockExtrinsics } from './types/responses/Block';

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
            if(extrinsic.method.pallet === "logionLoc" && extrinsic.method.method === "close") {
                const locId = extrinsic.args['locId'];
                const loc = await this.locRequestRepository.findById(locId);
                if(loc === undefined) {
                    throw Error(`No LOC with ID ${locId}`);
                }
                loc.close(timestamp);
                await this.locRequestRepository.save(loc);
            }
        }
    }

    async reset() {
        await this.locRequestRepository.deleteAll();
    }
}
