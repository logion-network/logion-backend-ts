import { injectable } from 'inversify';
import { UUID, Adapters, Fees } from "@logion/node-api";
import { Log, PolkadotService, requireDefined } from "@logion/rest-api-core";
import { Moment } from "moment";

import { LocRequestAggregateRoot, LocRequestRepository } from '../model/locrequest.model.js';
import { JsonExtrinsic, toString, extractUuid } from "./types/responses/Extrinsic.js";
import { CollectionFactory } from "../model/collection.model.js";
import { LocRequestService } from './locrequest.service.js';
import { CollectionService } from './collection.service.js';
import { UserIdentity } from '../model/useridentity.js';
import { NotificationService } from './notification.service.js';
import { DirectoryService } from './directory.service.js';
import { VerifiedIssuerSelectionService } from './verifiedissuerselection.service.js';
import { TokensRecordService } from './tokensrecord.service.js';
import { TokensRecordFactory } from '../model/tokensrecord.model.js';

const { logger } = Log;

@injectable()
export class LocSynchronizer {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private collectionFactory: CollectionFactory,
        private locRequestService: LocRequestService,
        private collectionService: CollectionService,
        private notificationService: NotificationService,
        private directoryService: DirectoryService,
        private polkadotService: PolkadotService,
        private verifiedIssuerSelectionService: VerifiedIssuerSelectionService,
        private tokensRecordService: TokensRecordService,
        private tokensRecordFactory: TokensRecordFactory,
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
                case "createCollectionLoc":
                case "createOtherIdentityLoc": {
                    await this.handleLocCreation(extrinsic, timestamp);
                    break;
                }
                case "addMetadata": {
                    const locId = extractUuid('loc_id', extrinsic.call.args);
                    await this.mutateLoc(locId, loc => this.updateMetadataItem(loc, timestamp, extrinsic));
                    break;
                }
                case "addFile": {
                    const locId = extractUuid('loc_id', extrinsic.call.args);
                    await this.mutateLoc(locId, loc => this.updateFile(loc, timestamp, extrinsic));
                    break;
                }
                case "addLink": {
                    const locId = extractUuid('loc_id', extrinsic.call.args);
                    await this.mutateLoc(locId, loc => this.updateLink(loc, timestamp, extrinsic));
                    break;
                }
                case "close":
                case "closeAndSeal": {
                    const locId = extractUuid('loc_id', extrinsic.call.args);
                    await this.mutateLoc(locId, async loc => loc.close(timestamp));
                    break;
                }
                case "makeVoid":
                case "makeVoidAndReplace": {
                    const locId = extractUuid('loc_id', extrinsic.call.args);
                    await this.mutateLoc(locId, async loc => loc.voidLoc(timestamp));
                    break;
                }
                case "addCollectionItem":
                case "addCollectionItemWithTermsAndConditions": {
                    await this.addCollectionItem(timestamp, extrinsic);
                    break;
                }
                case "nominateIssuer":
                case "dismissIssuer":
                    await this.notifyIssuerNominatedDismissed(extrinsic);
                    break;
                case "setIssuerSelection":
                    await this.handleIssuerSelectedUnselected(extrinsic);
                    break;
                case "addTokensRecord": {
                    const locId = extractUuid('collection_loc_id', extrinsic.call.args);
                    await this.addTokensRecord(locId, timestamp, extrinsic);
                    break;
                }
                case "acknowledgeFile":
                    await this.confirmAcknowledgedFile(timestamp, extrinsic);
                    break;
                case "acknowledgeMetadata":
                    await this.confirmAcknowledgedMetadata(timestamp, extrinsic);
                    break;
                case "sponsor":
                case "withdrawSponsorship":
                    // Nothing to sync
                    break;
                default:
                    throw new Error(`Unexpected method in pallet logionLoc: ${extrinsic.call.method}`)
            }
        }
    }

    private async handleLocCreation(extrinsic: JsonExtrinsic, timestamp: Moment) {
        const locId = extractUuid('loc_id', extrinsic.call.args);
        const inclusionFee = await extrinsic.partialFee();
        if(inclusionFee) {
            await this.mutateLoc(locId, async loc => {
                loc.setLocCreatedDate(timestamp);
                // TODO set fees (inclusion and legal)
            });
        } else {
            throw new Error("Could not get inclusion fee");
        }
    }

    private async mutateLoc(locId: string, mutator: (loc: LocRequestAggregateRoot) => Promise<void>) {
        await this.locRequestService.updateIfExists(locId, async loc => {
            logger.info("Mutating LOC %s : %s", locId, mutator);
            await mutator(loc);
        });
    }

    private async updateMetadataItem(loc: LocRequestAggregateRoot, timestamp: Moment, extrinsic: JsonExtrinsic) {
        const nameHash = Adapters.asHexString(Adapters.asJsonObject(extrinsic.call.args['item']).name);
        loc.setMetadataItemAddedOn(nameHash, timestamp);
        const inclusionFee = await extrinsic.partialFee();
        if(inclusionFee) {
            loc.setMetadataItemFee(nameHash, BigInt(inclusionFee));
        } else {
            throw new Error("Could not get inclusion fee");
        }
    }

    private async updateFile(loc: LocRequestAggregateRoot, timestamp: Moment, extrinsic: JsonExtrinsic) {
        const hash = this.getFileHash(extrinsic);
        loc.setFileAddedOn(hash, timestamp);
        const inclusionFee = await extrinsic.partialFee();
        const storageFee = extrinsic.storageFee;
        if(inclusionFee) {
            loc.setFileFees(
                hash,
                new Fees({ inclusionFee: BigInt(inclusionFee), storageFee: storageFee?.fee}),
                extrinsic.storageFee?.withdrawnFrom
            );
        } else {
            throw new Error("Could not get inclusion fee");
        }
    }

    private getFileHash(extrinsic: JsonExtrinsic): string {
        const file = Adapters.asJsonObject(extrinsic.call.args['file']);
        if("hash_" in file && Adapters.isHexString(file.hash_)) {
            return Adapters.asHexString(file.hash_);
        } else if("hash" in file && Adapters.isHexString(file.hash)) {
            return Adapters.asHexString(file.hash);
        } else {
            throw new Error("File has no hash");
        }
    }

    private async updateLink(loc: LocRequestAggregateRoot, timestamp: Moment, extrinsic: JsonExtrinsic) {
        const decimalTarget = Adapters.asBigInt(Adapters.asJsonObject(extrinsic.call.args['link']).id).toString();
        const target = UUID.fromDecimalStringOrThrow(decimalTarget).toString();
        loc.setLinkAddedOn(target, timestamp);
        const inclusionFee = await extrinsic.partialFee();
        if(inclusionFee) {
            loc.setLinkFee(target, BigInt(inclusionFee));
        } else {
            throw new Error("Could not get inclusion fee");
        }
    }

    private async addCollectionItem(timestamp: Moment, extrinsic: JsonExtrinsic) {
        const collectionLocId = extractUuid('collection_loc_id', extrinsic.call.args);
        const itemId = Adapters.asHexString(extrinsic.call.args['item_id']);
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

    private async notifyIssuerNominatedDismissed(extrinsic: JsonExtrinsic) {
        const nominated = extrinsic.call.method === "nominateIssuer";
        const legalOfficerAddress = requireDefined(extrinsic.signer);
        if(await this.directoryService.isLegalOfficerAddressOnNode(legalOfficerAddress)) {
            const issuerAddress = Adapters.asString(extrinsic.call.args["issuer"]);
            const identityLoc = await this.getIssuerIdentityLoc(legalOfficerAddress, issuerAddress);
            if(identityLoc) {
                logger.info("Handling nomination/dismissal of issuer %s", issuerAddress);
                if(!nominated) {
                    this.verifiedIssuerSelectionService.unselectAll(issuerAddress);
                }
                this.notifyVerifiedIssuerNominatedDismissed({
                    legalOfficerAddress,
                    nominated,
                    issuer: identityLoc.getDescription().userIdentity,
                });
            }
        }
    }

    private async getIssuerIdentityLoc(legalOfficerAddress: string, issuerAddress: string) {
        const api = await this.polkadotService.readyApi();
        const verifiedIssuer = await api.polkadot.query.logionLoc.verifiedIssuersMap(legalOfficerAddress, issuerAddress);
        if(verifiedIssuer.isNone) {
            throw new Error(`${issuerAddress} is not an issuer of LO ${legalOfficerAddress}`);
        }

        const identityLocId = api.adapters.fromLocId(verifiedIssuer.unwrap().identityLoc);
        const identityLoc = await this.locRequestRepository.findById(identityLocId.toString());
        if(!identityLoc) {
            throw new Error("No Identity LOC available for issuer");
        }
        return identityLoc;
    }

    private async notifyVerifiedIssuerNominatedDismissed(args: {
        legalOfficerAddress: string,
        nominated: boolean,
        issuer?: UserIdentity,
    }) {
        const { legalOfficerAddress, nominated, issuer } = args;
        try {
            const legalOfficer = await this.directoryService.get(legalOfficerAddress);
            const data = {
                legalOfficer,
                walletUser: issuer,
            };
            if(nominated) {
                await this.notificationService.notify(issuer?.email, "verified-issuer-nominated", data);
            } else {
                await this.notificationService.notify(issuer?.email, "verified-issuer-dismissed", data);
            }
        } catch(e) {
            logger.error("Failed to notify verified issuer: %s. Mail '%s' not sent.", e, nominated ? "verified-issuer-nominated" : "verified-issuer-dismissed");
        }
    }

    private async handleIssuerSelectedUnselected(extrinsic: JsonExtrinsic) {
        const legalOfficerAddress = requireDefined(extrinsic.signer);
        if(await this.directoryService.isLegalOfficerAddressOnNode(legalOfficerAddress)) {
            const issuerAddress = Adapters.asString(extrinsic.call.args["issuer"]);
            const identityLoc = await this.getIssuerIdentityLoc(legalOfficerAddress, issuerAddress);
            const selected = extrinsic.call.args["selected"] as boolean;
            const requestId = extractUuid("loc_id", extrinsic.call.args);
            const locRequest = requireDefined(await this.locRequestRepository.findById(requestId));

            logger.info("Handling selection/unselection of issuer %s", issuerAddress);
            this.verifiedIssuerSelectionService.selectUnselect(locRequest, identityLoc, selected);
            this.notifyVerifiedIssuerSelectedUnselected({
                legalOfficerAddress,
                selected,
                locRequest,
                issuer: identityLoc.getDescription().userIdentity,
            });
        }
    }

    private async notifyVerifiedIssuerSelectedUnselected(args: {
        legalOfficerAddress: string,
        selected: boolean,
        locRequest: LocRequestAggregateRoot,
        issuer?: UserIdentity,
    }) {
        const { legalOfficerAddress, selected, locRequest, issuer } = args;
        try {
            const legalOfficer = await this.directoryService.get(legalOfficerAddress);
            const data = {
                legalOfficer,
                walletUser: issuer,
                loc: {
                    ...locRequest.getDescription(),
                    id: locRequest.id,
                }
            };
            if(selected) {
                await this.notificationService.notify(issuer?.email, "verified-issuer-selected", data);
            } else {
                await this.notificationService.notify(issuer?.email, "verified-issuer-unselected", data);
            }
        } catch(e) {
            logger.error("Failed to notify verified issuer: %s. Mail '%s' not sent.", e, selected ? "verified-issuer-selected" : "verified-issuer-unselected");
        }
    }

    private async addTokensRecord(collectionLocId: string, timestamp: Moment, extrinsic: JsonExtrinsic) {
        const recordId = Adapters.asHexString(extrinsic.call.args['record_id']);
        const loc = await this.locRequestRepository.findById(collectionLocId);
        if (loc !== null) {
            logger.info("Adding Tokens Record %s to LOC %s", recordId, collectionLocId);
            let created = false;
            await this.tokensRecordService.createIfNotExist(collectionLocId, recordId, () => {
                created = true;
                return this.tokensRecordFactory.newTokensRecord({
                    collectionLocId,
                    recordId,
                    addedOn: timestamp
                });
            });
            if(!created) {
                await this.tokensRecordService.update(collectionLocId, recordId, async record => {
                    record.setAddedOn(timestamp);
                });
            }
        }
    }

    private async confirmAcknowledgedFile(timestamp: Moment, extrinsic: JsonExtrinsic) {
        const locId = extractUuid('loc_id', extrinsic.call.args);
        const hash = Adapters.asHexString(extrinsic.call.args['hash']);
        await this.mutateLoc(locId, async loc => loc.confirmFileAcknowledged(hash, timestamp));
    }

    private async confirmAcknowledgedMetadata(timestamp: Moment, extrinsic: JsonExtrinsic) {
        const locId = extractUuid('loc_id', extrinsic.call.args);
        const nameHash = Adapters.asHexString(extrinsic.call.args['name']);
        await this.mutateLoc(locId, async loc => loc.confirmMetadataItemAcknowledged(nameHash, timestamp));
    }
}
