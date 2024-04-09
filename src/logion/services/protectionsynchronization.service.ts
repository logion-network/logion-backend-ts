import { injectable } from 'inversify';
import { Log } from "@logion/rest-api-core";

import { ProtectionRequestRepository, FetchProtectionRequestsSpecification } from '../model/protectionrequest.model.js';
import { Adapters, ValidAccountId } from '@logion/node-api';
import { JsonExtrinsic, toString } from "./types/responses/Extrinsic.js";
import { ProtectionRequestService } from './protectionrequest.service.js';
import { DirectoryService } from "./directory.service.js";

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
                const legalOfficerAddresses = Adapters.asArray(extrinsic.call.args['legal_officers']).map(address => Adapters.asString(address));
                for (const legalOfficerAddress of legalOfficerAddresses) {
                    const legalOfficer = ValidAccountId.polkadot(legalOfficerAddress);
                    if (await this.directoryService.isLegalOfficerAddressOnNode(legalOfficer)) {
                        const signer = extrinsic.signer!;
                        const requests = await this.protectionRequestRepository.findBy(new FetchProtectionRequestsSpecification({
                            expectedRequesterAddress: ValidAccountId.polkadot(signer),
                            expectedLegalOfficerAddress: [ legalOfficer ],
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
