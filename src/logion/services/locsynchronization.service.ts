import { injectable } from 'inversify';
import { UUID, Adapters, Fees, Hash, Lgnt, ValidAccountId } from "@logion/node-api";
import { Log, requireDefined } from "@logion/rest-api-core";
import { Moment } from "moment";

import { LocRequestAggregateRoot, LocRequestRepository } from '../model/locrequest.model.js';
import { JsonExtrinsic, toString, extractUuid } from "./types/responses/Extrinsic.js";
import { LocRequestService } from './locrequest.service.js';
import { CollectionService } from './collection.service.js';
import { UserIdentity } from '../model/useridentity.js';
import { NotificationService } from './notification.service.js';
import { LegalOfficerService } from './legalOfficerService.js';
import { VerifiedIssuerSelectionService } from './verifiedissuerselection.service.js';
import { TokensRecordService } from './tokensrecord.service.js';
import { EMPTY_ITEMS, LocItems } from '../model/loc_items.js';

const { logger } = Log;

@injectable()
export class LocSynchronizer {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private locRequestService: LocRequestService,
        private collectionService: CollectionService,
        private notificationService: NotificationService,
        private directoryService: LegalOfficerService,
        private verifiedIssuerSelectionService: VerifiedIssuerSelectionService,
        private tokensRecordService: TokensRecordService,
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
                case "acknowledgeLink":
                    await this.confirmAcknowledgedLink(timestamp, extrinsic);
                    break;
                case "sponsor":
                case "withdrawSponsorship":
                case "setInvitedContributorSelection":
                case "importLoc":
                case "importCollectionItem":
                case "importTokensRecord":
                case "importInvitedContributorSelection":
                case "importVerifiedIssuer":
                case "importVerifiedIssuerSelection":
                case "importSponsorship":
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
                loc.open(timestamp, this.extractLocItems(extrinsic));
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

    private extractLocItems(extrinsic: JsonExtrinsic): LocItems {
        const items = extrinsic.call.args["items"];
        if(Adapters.isJsonObject(items)) {
            const metadata = Adapters.asArray(items.metadata).map(Adapters.asJsonObject);
            const files = Adapters.asArray(items.files).map(Adapters.asJsonObject);
            const links = Adapters.asArray(items.links).map(Adapters.asJsonObject);
            return {
                fileHashes: files.map(item => Adapters.asHexString(item.hash_)).map(Hash.fromHex),
                linkTargets: links.map(item => Adapters.asBigInt(item.id).toString()).map(UUID.fromDecimalString).map(maybeUuid => requireDefined(maybeUuid)),
                metadataNameHashes: metadata.map(item => Adapters.asHexString(item.name)).map(Hash.fromHex),
            };
        } else {
            return EMPTY_ITEMS;
        }
    }

    private async updateMetadataItem(loc: LocRequestAggregateRoot, timestamp: Moment, extrinsic: JsonExtrinsic) {
        const nameHash = Hash.fromHex(Adapters.asHexString(Adapters.asJsonObject(extrinsic.call.args['item']).name));
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
                new Fees({
                    inclusionFee: Lgnt.fromCanonical(BigInt(inclusionFee)),
                    storageFee: storageFee?.fee !== undefined ? Lgnt.fromCanonical(storageFee.fee) : undefined,
                }),
                extrinsic.storageFee?.withdrawnFrom
            );
        } else {
            throw new Error("Could not get inclusion fee");
        }
    }

    private getFileHash(extrinsic: JsonExtrinsic): Hash {
        const file = Adapters.asJsonObject(extrinsic.call.args['file']);
        if("hash_" in file && Adapters.isHexString(file.hash_)) {
            return Hash.fromHex(Adapters.asHexString(file.hash_));
        } else if("hash" in file && Adapters.isHexString(file.hash)) {
            return Hash.fromHex(Adapters.asHexString(file.hash));
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
        const itemId = Hash.fromHex(Adapters.asHexString(extrinsic.call.args['item_id']));
        const loc = await this.locRequestRepository.findById(collectionLocId);
        if (loc !== null) {
            logger.info("Confirming Collection Item %s to LOC %s", itemId, collectionLocId);
            await this.collectionService.update(collectionLocId, itemId, async item => {
                item.confirm(timestamp);
            });
        }
    }

    private async notifyIssuerNominatedDismissed(extrinsic: JsonExtrinsic) {
        const nominated = extrinsic.call.method === "nominateIssuer";
        const legalOfficerAddress = ValidAccountId.polkadot(requireDefined(extrinsic.signer));
        if(await this.directoryService.isLegalOfficerAddressOnNode(legalOfficerAddress)) {
            const issuerAccount = ValidAccountId.polkadot(Adapters.asString(extrinsic.call.args["issuer"]));
            const identityLoc = await this.getIssuerIdentityLoc(legalOfficerAddress, issuerAccount);
            logger.info("Handling nomination/dismissal of issuer %s", issuerAccount.address);
            if(!nominated) {
                this.verifiedIssuerSelectionService.unselectAll(issuerAccount);
            }
            this.notifyVerifiedIssuerNominatedDismissed({
                legalOfficerAddress,
                nominated,
                issuer: identityLoc.getDescription().userIdentity,
            });
        }
    }

    private async getIssuerIdentityLoc(legalOfficerAddress: ValidAccountId, issuerAddress: ValidAccountId): Promise<LocRequestAggregateRoot> {
        const identityLocs = await this.locRequestRepository.findBy({
            expectedLocTypes: [ "Identity" ],
            expectedIdentityLocType: "Polkadot",
            expectedOwnerAddress: [ legalOfficerAddress ],
            expectedRequesterAddress: issuerAddress,
            expectedStatuses: [ "CLOSED" ]
        });
        if(identityLocs.length < 1) {
            throw new Error("No Identity LOC available for issuer");
        }
        return identityLocs[0];
    }

    private async notifyVerifiedIssuerNominatedDismissed(args: {
        legalOfficerAddress: ValidAccountId,
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
        const legalOfficerAddress = ValidAccountId.polkadot(requireDefined(extrinsic.signer));
        if(await this.directoryService.isLegalOfficerAddressOnNode(legalOfficerAddress)) {
            const issuerAccount = ValidAccountId.polkadot(Adapters.asString(extrinsic.call.args["issuer"]));
            const identityLoc = await this.getIssuerIdentityLoc(legalOfficerAddress, issuerAccount);
            const selected = extrinsic.call.args["selected"] as boolean;
            const requestId = extractUuid("loc_id", extrinsic.call.args);
            const locRequest = requireDefined(await this.locRequestRepository.findById(requestId));

            logger.info("Handling selection/unselection of issuer %s", issuerAccount.address);
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
        legalOfficerAddress: ValidAccountId,
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
        const recordId = Hash.fromHex(Adapters.asHexString(extrinsic.call.args['record_id']));
        const loc = await this.locRequestRepository.findById(collectionLocId);
        if (loc !== null) {
            logger.info("Confirming Tokens Record %s to LOC %s", recordId, collectionLocId);
            await this.tokensRecordService.update(collectionLocId, recordId, async record => {
                record.confirm(timestamp);
            });
        }
    }

    private async confirmAcknowledgedFile(timestamp: Moment, extrinsic: JsonExtrinsic) {
        const locId = extractUuid('loc_id', extrinsic.call.args);
        const hash = Hash.fromHex(Adapters.asHexString(extrinsic.call.args['hash']));
        const contributor = ValidAccountId.polkadot(requireDefined(extrinsic.signer));
        await this.mutateLoc(locId, async loc => loc.preAcknowledgeFile(hash, contributor, timestamp));
    }

    private async confirmAcknowledgedMetadata(timestamp: Moment, extrinsic: JsonExtrinsic) {
        const locId = extractUuid('loc_id', extrinsic.call.args);
        const nameHash = Hash.fromHex(Adapters.asHexString(extrinsic.call.args['name']));
        const contributor = ValidAccountId.polkadot(requireDefined(extrinsic.signer));
        await this.mutateLoc(locId, async loc => loc.preAcknowledgeMetadataItem(nameHash, contributor, timestamp));
    }

    private async confirmAcknowledgedLink(timestamp: Moment, extrinsic: JsonExtrinsic) {
        const locId = extractUuid('loc_id', extrinsic.call.args);
        const target = extractUuid('target', extrinsic.call.args);
        const contributor = ValidAccountId.polkadot(requireDefined(extrinsic.signer));
        await this.mutateLoc(locId, async loc => loc.preAcknowledgeLink(target, contributor, timestamp));
    }
}
