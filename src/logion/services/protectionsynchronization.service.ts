import { injectable } from 'inversify';
import { ProtectionRequestRepository, FetchProtectionRequestsSpecification } from '../model/protectionrequest.model';
import { ExtrinsicDataExtractor } from "../services/extrinsic.data.extractor";

import { BlockExtrinsics } from './types/responses/Block';
import { JsonArgs } from './call';

@injectable()
export class ProtectionSynchronizer {

    constructor(
        private extrinsicDataExtractor: ExtrinsicDataExtractor,
        private protectionRequestRepository: ProtectionRequestRepository,
    ) {
        if (process.env.OWNER === undefined) {
            throw Error("No node owner set, please set var OWNER");
        }
        this.nodeOwner = process.env.OWNER;
    }

    readonly nodeOwner: string;

    async updateProtectionRequests(block: BlockExtrinsics): Promise<void> {
        const timestamp = this.extrinsicDataExtractor.getBlockTimestamp(block);
        if(timestamp === undefined) {
            throw Error("Block has no timestamp");
        }
        for(let i = 0; i < block.extrinsics.length; ++i) {
            const extrinsic = block.extrinsics[i];
            if(extrinsic.method.pallet === "verifiedRecovery") {
                if(extrinsic.method.method === "createRecovery" && this.nodeOwnerInFriends(extrinsic.args)) {
                    const signer = extrinsic.signer!;
                    const requests = await this.protectionRequestRepository.findBy(new FetchProtectionRequestsSpecification({
                        expectedRequesterAddress: signer,
                        expectedStatuses: [ 'ACCEPTED' ],
                    }));
                    for(let j = 0; j < requests.length; ++j) {
                        const request = requests[j];
                        request.setActivated();
                        await this.protectionRequestRepository.save(request);
                    }
                }
            }
        }
    }

    private nodeOwnerInFriends(args: JsonArgs): boolean {
        const legalOfficers = args['legal_officers'].map((codec: any) => codec.toString());
        return legalOfficers.includes(this.nodeOwner);
    }
}
