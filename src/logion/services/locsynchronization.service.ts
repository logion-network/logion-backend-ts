import { injectable } from 'inversify';
import { LocRequestAggregateRoot, LocRequestRepository } from '../model/locrequest.model';
import { decimalToUuid } from '../lib/uuid';
import { JsonArgs } from './call';
import { JsonExtrinsic, toString } from "./types/responses/Extrinsic";
import { Moment } from "moment";
import { Log } from "../util/Log";

const { logger } = Log;

@injectable()
export class LocSynchronizer {

    constructor(
        private locRequestRepository: LocRequestRepository,
    ) {}

    async updateLocRequests(extrinsic: JsonExtrinsic, timestamp: Moment) {
        if (extrinsic.method.pallet === "logionLoc") {
            const error = extrinsic.error();
            if (error) {
                logger.info("updateLocRequests() - Skipping extrinsic with error: %s", toString(extrinsic, error))
                return
            }

            switch (extrinsic.method.method) {
                case "createLogionIdentityLoc":
                case "createLogionTransactionLoc":
                case "createPolkadotIdentityLoc":
                case "createPolkadotTransactionLoc":
                case "createCollectionLoc": {
                    const locId = this.extractLocId('loc_id', extrinsic.args);
                    await this.mutateLoc(locId, loc => loc.setLocCreatedDate(timestamp));
                    break;
                }
                case "addMetadata": {
                    const locId = this.extractLocId('loc_id', extrinsic.args);
                    const name = extrinsic.args['item'].name.toUtf8();
                    await this.mutateLoc(locId, loc => loc.setMetadataItemAddedOn(name, timestamp));
                    break;
                }
                case "addFile": {
                    const locId = this.extractLocId('loc_id', extrinsic.args);
                    const hash = extrinsic.args['file'].get('hash').toHex();
                    await this.mutateLoc(locId, loc => loc.setFileAddedOn(hash, timestamp));
                    break;
                }
                case "addLink": {
                    const locId = this.extractLocId('loc_id', extrinsic.args);
                    const target = decimalToUuid(extrinsic.args['link'].id.toString());
                    await this.mutateLoc(locId, loc => loc.setLinkAddedOn(target, timestamp));
                    break;
                }
                case "close": {
                    const locId = this.extractLocId('loc_id', extrinsic.args);
                    await this.mutateLoc(locId, loc => loc.close(timestamp));
                    break;
                }
                case "makeVoid":
                case "makeVoidAndReplace": {
                    const locId = this.extractLocId('loc_id', extrinsic.args);
                    await this.mutateLoc(locId, loc => loc.voidLoc(timestamp));
                    break;
                }
                default:
                    logger.warn("Unexpected method in pallet logionLoc: %s", extrinsic.method.method)
            }
        }
    }

    private extractLocId(locIdKey: string, args: JsonArgs): string {
        return decimalToUuid(args[locIdKey].toString());
    }

    private async mutateLoc(locId: string, mutator: (loc: LocRequestAggregateRoot) => void) {
        const loc = await this.locRequestRepository.findById(locId);
        if(loc !== undefined) {
            logger.info("Mutating LOC %s : %s", locId, mutator)
            mutator(loc);
            await this.locRequestRepository.save(loc);
        }
    }
}
