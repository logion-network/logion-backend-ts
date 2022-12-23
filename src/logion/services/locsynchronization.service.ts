import { injectable } from 'inversify';
import { UUID, asBigInt, asHexString, asJsonObject, asString, isHexString } from "@logion/node-api";
import { Log } from "@logion/rest-api-core";
import { Moment } from "moment";

import { LocRequestAggregateRoot, LocRequestRepository } from '../model/locrequest.model.js';
import { JsonExtrinsic, toString, extractLocId } from "./types/responses/Extrinsic.js";
import { CollectionFactory } from "../model/collection.model.js";
import { LocRequestService } from './locrequest.service.js';
import { CollectionService } from './collection.service.js';

const { logger } = Log;

@injectable()
export class LocSynchronizer {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private collectionFactory: CollectionFactory,
        private locRequestService: LocRequestService,
        private collectionService: CollectionService,
    ) {}

    async updateLocRequests(extrinsic: JsonExtrinsic, timestamp: Moment) {
        if (extrinsic.call.section === "logionLoc") {
            const error = extrinsic.error();
            if (error) {
                logger.info("updateLocRequests() - Skipping extrinsic with error: %s", toString(extrinsic, error))
                return
            }

            // Note to developers:
            // Refrain from removing methods that no longer exist in the pallet (for instance "createLoc"),
            // because they are still present in the extrinsics created at the time those methods were active.
            switch (extrinsic.call.method) {
                case "createLoc":
                case "createLogionIdentityLoc":
                case "createLogionTransactionLoc":
                case "createPolkadotIdentityLoc":
                case "createPolkadotTransactionLoc":
                case "createCollectionLoc": {
                    const locId = extractLocId('loc_id', extrinsic.call.args);
                    await this.mutateLoc(locId, loc => loc.setLocCreatedDate(timestamp));
                    break;
                }
                case "addMetadata": {
                    const locId = extractLocId('loc_id', extrinsic.call.args);
                    const name = asString(asJsonObject(extrinsic.call.args['item']).name);
                    await this.mutateLoc(locId, loc => loc.setMetadataItemAddedOn(name, timestamp));
                    break;
                }
                case "addFile": {
                    const locId = extractLocId('loc_id', extrinsic.call.args);
                    const hash = this.getFileHash(extrinsic);
                    await this.mutateLoc(locId, loc => loc.setFileAddedOn(hash, timestamp));
                    break;
                }
                case "addLink": {
                    const locId = extractLocId('loc_id', extrinsic.call.args);
                    const target = asBigInt(asJsonObject(extrinsic.call.args['link']).id).toString();
                    await this.mutateLoc(locId, loc => loc.setLinkAddedOn(UUID.fromDecimalStringOrThrow(target).toString(), timestamp));
                    break;
                }
                case "close":
                case "closeAndSeal": {
                    const locId = extractLocId('loc_id', extrinsic.call.args);
                    await this.mutateLoc(locId, loc => loc.close(timestamp));
                    break;
                }
                case "makeVoid":
                case "makeVoidAndReplace": {
                    const locId = extractLocId('loc_id', extrinsic.call.args);
                    await this.mutateLoc(locId, loc => loc.voidLoc(timestamp));
                    break;
                }
                case "addCollectionItem":
                case "addCollectionItemWithTermsAndConditions": {
                    const locId = extractLocId('collection_loc_id', extrinsic.call.args);
                    const itemId = asHexString(extrinsic.call.args['item_id']);
                    await this.addCollectionItem(locId, itemId, timestamp)
                    break;
                }
                default:
                    throw new Error(`Unexpected method in pallet logionLoc: ${extrinsic.call.method}`)
            }
        }
    }

    private getFileHash(extrinsic: JsonExtrinsic): string {
        const file = asJsonObject(extrinsic.call.args['file']);
        if("hash_" in file && isHexString(file.hash_)) {
            return asHexString(file.hash_);
        } else if("hash" in file && isHexString(file.hash)) {
            return asHexString(file.hash);
        } else {
            throw new Error("File has no hash");
        }
    }

    private async mutateLoc(locId: string, mutator: (loc: LocRequestAggregateRoot) => void) {
        await this.locRequestService.updateIfExists(locId, async loc => {
            logger.info("Mutating LOC %s : %s", locId, mutator);
            mutator(loc);
        });
    }

    private async addCollectionItem(collectionLocId: string, itemId: string, timestamp: Moment) {
        const loc = await this.locRequestRepository.findById(collectionLocId);
        if (loc !== null) {
            logger.info("Adding Collection Item %s to LOC %s", itemId, collectionLocId);
            let created = false;
            await this.collectionService.createIfNotExist(collectionLocId, itemId, () => {
                created = true;
                return this.collectionFactory.newItem({
                    collectionLocId,
                    itemId,
                    addedOn: timestamp
                });
            });
            if(!created) {
                await this.collectionService.update(collectionLocId, itemId, async item => {
                    item.setAddedOn(timestamp);
                });
            }
        }
    }
}
