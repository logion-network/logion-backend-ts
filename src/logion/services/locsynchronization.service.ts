import { injectable } from 'inversify';
import { Log } from "@logion/rest-api-core";
import { Moment } from "moment";

import { LocRequestAggregateRoot, LocRequestRepository } from '../model/locrequest.model';
import { decimalToUuid } from '../lib/uuid';
import { JsonArgs } from './call';
import { JsonExtrinsic, toString } from "./types/responses/Extrinsic";
import { CollectionRepository, CollectionFactory } from "../model/collection.model";

const { logger } = Log;

@injectable()
export class LocSynchronizer {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private collectionFactory: CollectionFactory,
        private collectionRepository: CollectionRepository,
    ) {}

    async updateLocRequests(extrinsic: JsonExtrinsic, timestamp: Moment) {
        if (extrinsic.method.pallet === "logionLoc") {
            const error = extrinsic.error();
            if (error) {
                logger.info("updateLocRequests() - Skipping extrinsic with error: %s", toString(extrinsic, error))
                return
            }

            // Note to developers:
            // Refrain from removing methods that no longer exist in the pallet (for instance "createLoc"),
            // because they are still present in the extrinsics created at the time those methods were active.
            switch (extrinsic.method.method) {
                case "createLoc":
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
                    const hash = extrinsic.args['file'].get('hash_').toHex();
                    await this.mutateLoc(locId, loc => loc.setFileAddedOn(hash, timestamp));
                    break;
                }
                case "addLink": {
                    const locId = this.extractLocId('loc_id', extrinsic.args);
                    const target = decimalToUuid(extrinsic.args['link'].id.toString());
                    await this.mutateLoc(locId, loc => loc.setLinkAddedOn(target, timestamp));
                    break;
                }
                case "close":
                case "closeAndSeal": {
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
                case "addCollectionItem":
                case "addCollectionItemWithTermsAndConditions": {
                    const locId = this.extractLocId('collection_loc_id', extrinsic.args);
                    const itemId = extrinsic.args['item_id'].toHex();
                    await this.addCollectionItem(locId, itemId, timestamp)
                    break;
                }
                default:
                    throw new Error(`Unexpected method in pallet logionLoc: ${extrinsic.method.method}`)
            }
        }
    }

    private extractLocId(locIdKey: string, args: JsonArgs): string {
        return decimalToUuid(args[locIdKey].toString());
    }

    private async mutateLoc(locId: string, mutator: (loc: LocRequestAggregateRoot) => void) {
        const loc = await this.locRequestRepository.findById(locId);
        if(loc !== null) {
            logger.info("Mutating LOC %s : %s", locId, mutator)
            mutator(loc);
            await this.locRequestRepository.save(loc);
        }
    }

    private async addCollectionItem(collectionLocId: string, itemId: string, timestamp: Moment) {
        const loc = await this.locRequestRepository.findById(collectionLocId);
        if (loc !== null) {
            logger.info("Adding Collection Item %s to LOC %s", itemId, collectionLocId);
            let collectionItem = await this.collectionRepository.findBy(collectionLocId, itemId);
            if(!collectionItem) {
                collectionItem = this.collectionFactory.newItem({
                    collectionLocId,
                    itemId,
                    addedOn: timestamp
                });
                await this.collectionRepository.save(collectionItem);
            } else if(!collectionItem.addedOn) {
                collectionItem.setAddedOn(timestamp);
                await this.collectionRepository.save(collectionItem);
            }
        }
    }
}
