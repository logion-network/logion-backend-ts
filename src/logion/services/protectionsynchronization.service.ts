import { injectable } from 'inversify';
import { Log } from "@logion/rest-api-core";

import { ProtectionRequestRepository, FetchProtectionRequestsSpecification } from '../model/protectionrequest.model';
import { asArray, asString, JsonArgs } from './call';
import { JsonExtrinsic, toString } from "./types/responses/Extrinsic";
import { ProtectionRequestService } from './protectionrequest.service';

const { logger } = Log;

@injectable()
export class ProtectionSynchronizer {

    constructor(
        private protectionRequestRepository: ProtectionRequestRepository,
        private protectionRequestService: ProtectionRequestService,
    ) {
        if (process.env.OWNER === undefined) {
            throw Error("No node owner set, please set var OWNER");
        }
        this.nodeOwner = process.env.OWNER;
    }

    readonly nodeOwner: string;

    async updateProtectionRequests(extrinsic: JsonExtrinsic): Promise<void> {
        if (extrinsic.call.section === "verifiedRecovery") {
            const error = extrinsic.error();
            if (error) {
                logger.info("updateProtectionRequests() - Skipping extrinsic with error: %s", toString(extrinsic, error))
                return
            }
            if (extrinsic.call.method === "createRecovery" && this.nodeOwnerInFriends(extrinsic.call.args)) {
                const signer = extrinsic.signer!;
                const requests = await this.protectionRequestRepository.findBy(new FetchProtectionRequestsSpecification({
                    expectedRequesterAddress: signer,
                    expectedStatuses: [ 'ACCEPTED' ],
                }));
                for (let j = 0; j < requests.length; ++j) {
                    const request = requests[j];
                    logger.info("Setting protection %s activated", request.id);
                    await this.protectionRequestService.update(request.id!, async request => {
                        request.setActivated();
                    });
                }
            }
        }
    }

    private nodeOwnerInFriends(args: JsonArgs): boolean {
        const legalOfficers = asArray(args['legal_officers']).map(address => asString(address));
        return legalOfficers.includes(this.nodeOwner);
    }
}
