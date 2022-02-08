import { injectable } from 'inversify';
import { ProtectionRequestRepository, FetchProtectionRequestsSpecification } from '../model/protectionrequest.model';
import { ExtrinsicDataExtractor } from "./extrinsic.data.extractor";
import { JsonArgs } from './call';
import { JsonExtrinsic, toString } from "./types/responses/Extrinsic";
import { Log } from "../util/Log";

const { logger } = Log;

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

    async updateProtectionRequests(extrinsic: JsonExtrinsic): Promise<void> {
        if (extrinsic.method.pallet === "verifiedRecovery") {
            const error = extrinsic.error();
            if (error) {
                logger.info("updateProtectionRequests() - Skipping extrinsic with error: %s", toString(extrinsic, error))
                return
            }
            if (extrinsic.method.method === "createRecovery" && this.nodeOwnerInFriends(extrinsic.args)) {
                const signer = extrinsic.signer!;
                const requests = await this.protectionRequestRepository.findBy(new FetchProtectionRequestsSpecification({
                    expectedRequesterAddress: signer,
                    expectedStatuses: [ 'ACCEPTED' ],
                }));
                for (let j = 0; j < requests.length; ++j) {
                    const request = requests[j];
                    logger.info("Setting protection %s activated", request.id)
                    request.setActivated();
                    await this.protectionRequestRepository.save(request);
                }
            }
        }
    }

    private nodeOwnerInFriends(args: JsonArgs): boolean {
        const legalOfficers = args['legal_officers'].map((codec: any) => codec.toString());
        return legalOfficers.includes(this.nodeOwner);
    }
}
