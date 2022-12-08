import { injectable } from 'inversify';
import { Log } from "@logion/rest-api-core";

import { ProtectionRequestRepository, FetchProtectionRequestsSpecification } from '../model/protectionrequest.model';
import { asArray, asString } from './call';
import { JsonExtrinsic, toString } from "./types/responses/Extrinsic";
import { ProtectionRequestService } from './protectionrequest.service';
import { DirectoryService } from "./directory.service";

const { logger } = Log;

@injectable()
export class ProtectionSynchronizer {

    constructor(
        private protectionRequestRepository: ProtectionRequestRepository,
        private protectionRequestService: ProtectionRequestService,
        private directoryService: DirectoryService,
    ) {
    }

    async updateProtectionRequests(extrinsic: JsonExtrinsic): Promise<void> {
        if (extrinsic.call.section === "verifiedRecovery") {
            const error = extrinsic.error();
            if (error) {
                logger.info("updateProtectionRequests() - Skipping extrinsic with error: %s", toString(extrinsic, error))
                return
            }
            if (extrinsic.call.method === "createRecovery") {
                const legalOfficerAddresses = asArray(extrinsic.call.args['legal_officers']).map(address => asString(address));
                for (const legalOfficerAddress of legalOfficerAddresses) {
                    if (await this.directoryService.isLegalOfficerAddressOnNode(legalOfficerAddress)) {
                        const signer = extrinsic.signer!;
                        const requests = await this.protectionRequestRepository.findBy(new FetchProtectionRequestsSpecification({
                            expectedRequesterAddress: signer,
                            expectedLegalOfficerAddress: legalOfficerAddress,
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
        }
    }
}
