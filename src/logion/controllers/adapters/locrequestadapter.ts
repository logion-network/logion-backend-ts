import { requireDefined } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { IdenfyService } from "../../services/idenfy/idenfy.service.js";
import {
    LocRequestAggregateRoot,
    LocRequestRepository,
    ItemLifecycle,
    LocFees,
    CollectionParams
} from "../../model/locrequest.model.js";
import { PostalAddress } from "../../model/postaladdress.js";
import { UserIdentity } from "../../model/useridentity.js";
import { components } from "../components.js";
import { VoteRepository, VoteAggregateRoot } from "../../model/vote.model.js";
import { VerifiedIssuerAggregateRoot, VerifiedIssuerSelectionRepository } from "../../model/verifiedissuerselection.model.js";
import { Fees } from "@logion/node-api";
import { SupportedAccountId } from "../../model/supportedaccountid.model.js";

export type UserPrivateData = {
    identityLocId: string | undefined,
    userIdentity: UserIdentity | undefined,
    userPostalAddress: PostalAddress | undefined
};

type LocRequestView = components["schemas"]["LocRequestView"];
type UserIdentityView = components["schemas"]["UserIdentityView"];
type PostalAddressView = components["schemas"]["PostalAddressView"];
type VerifiedIssuerIdentity = components["schemas"]["VerifiedIssuerIdentity"];
type FeesView = components["schemas"]["FeesView"];
type LocFeesView = components["schemas"]["LocFeesView"];
type CollectionParamsView = components["schemas"]["CollectionParamsView"];

@injectable()
export class LocRequestAdapter {

    constructor(
        private locRequestRepository: LocRequestRepository,
        private idenfyService: IdenfyService,
        private voteRepository: VoteRepository,
        private verifiedIssuerSelectionRepository: VerifiedIssuerSelectionRepository,
    ) {}

    async toView(request: LocRequestAggregateRoot, viewer: SupportedAccountId, userPrivateDataArg?: UserPrivateData): Promise<LocRequestView> {
        let userPrivateData: UserPrivateData;
        if(userPrivateDataArg) {
            userPrivateData = userPrivateDataArg;
        } else {
            userPrivateData = await this.findUserPrivateData(request);
        }

        const id = requireDefined(request.id);
        const locDescription = request.getDescription();
        let iDenfy = undefined;
        if(request.iDenfyVerification
            && request.iDenfyVerification.status
            && request.iDenfyVerification.authToken) {
            iDenfy = {
                status: request.iDenfyVerification.status,
                redirectUrl: request.iDenfyVerification.status === "PENDING" ? this.idenfyService.redirectUrl(request.iDenfyVerification.authToken) : undefined,
            };
        }

        let vote: VoteAggregateRoot | null = null;
        if (request.status === 'CLOSED') {
            vote = await this.voteRepository.findByLocId(request.id!);
        }

        let selectedIssuers: VerifiedIssuerIdentity[] = [];
        if (request.status === 'OPEN' || request.status === 'CLOSED') {
            const selections = await this.verifiedIssuerSelectionRepository.findBy({ locRequestId: request.id });
            selectedIssuers = await this.getSelectedIssuersIdentities(selections);
        }

        const view: LocRequestView = {
            id,
            requesterAddress: locDescription.requesterAddress,
            requesterIdentityLoc: locDescription.requesterIdentityLoc,
            ownerAddress: locDescription.ownerAddress,
            description: locDescription.description,
            locType: locDescription.locType,
            identityLoc: userPrivateData.identityLocId,
            userIdentity: toUserIdentityView(userPrivateData.userIdentity),
            userPostalAddress: toUserPostalAddressView(userPrivateData.userPostalAddress),
            createdOn: locDescription.createdOn || undefined,
            status: request.status,
            rejectReason: request.rejectReason || undefined,
            decisionOn: request.decisionOn || undefined,
            closedOn: request.closedOn || undefined,
            files: request.getFiles(viewer).map(file => ({
                name: file.name,
                hash: file.hash.toHex(),
                nature: file.nature,
                submitter: file.submitter,
                restrictedDelivery: file.restrictedDelivery,
                contentType: file.contentType,
                size: file.size.toString(),
                fees: toFeesView(file.fees),
                storageFeePaidBy: file.storageFeePaidBy,
                ...toLifecycleView(file),
            })),
            metadata: request.getMetadataItems(viewer).map(item => ({
                name: item.name,
                nameHash: item.nameHash.toHex(),
                value: item.value,
                submitter: item.submitter,
                fees: toFeesView(item.fees),
                ...toLifecycleView(item),
            })),
            links: request.getLinks(viewer).map(link => ({
                target: link.target,
                nature: link.nature,
                submitter: link.submitter,
                fees: toFeesView(link.fees),
                ...toLifecycleView(link),
            })),
            seal: locDescription.seal?.hash ? locDescription.seal.hash.toHex() : undefined,
            company: locDescription.company,
            iDenfy,
            voteId: vote?.voteId,
            selectedIssuers,
            template: locDescription.template,
            sponsorshipId: locDescription.sponsorshipId?.toString(),
            fees: this.toLocFeesView(locDescription.fees),
            collectionParams: this.toCollectionParamsView(locDescription.collectionParams),
        };
        const voidInfo = request.getVoidInfo();
        if(voidInfo !== null) {
            view.voidInfo = {
                reason: voidInfo.reason,
                voidedOn: voidInfo.voidedOn?.toISOString()
            };
        }
        return view;
    }

    async findUserPrivateData(request: LocRequestAggregateRoot): Promise<UserPrivateData> {
        const description = request.getDescription();
        if (description.locType === "Identity") {
            return {
                identityLocId: undefined,
                ...description
            };
        } else {
            return this.getUserPrivateData(description.requesterIdentityLoc!)
        }
    }

    async getUserPrivateData(identityLocId: string): Promise<UserPrivateData> {
        const identityLoc = requireDefined(await this.locRequestRepository.findById(identityLocId), () => new Error(`Unable to find ID LOC ${ identityLocId }`));
        return {
            identityLocId: identityLoc.id,
            ...identityLoc.getDescription()
        }
    }

    async getSelectedIssuersIdentities(selectedIssuers: VerifiedIssuerAggregateRoot[]): Promise<VerifiedIssuerIdentity[]> {
        const identities: VerifiedIssuerIdentity[] = [];
        for(const selectedIssuer of selectedIssuers) {
            const issuer = selectedIssuer?.issuer || "";
            if(selectedIssuer?.identityLocId) {
                const identityLoc = requireDefined(await this.locRequestRepository.findById(selectedIssuer.identityLocId.toString()));
                identities.push({
                    address: issuer,
                    identityLocId: selectedIssuer.identityLocId,
                    identity: identityLoc.getDescription().userIdentity,
                    selected: selectedIssuer.selected || false,
                });
            } else {
                throw new Error("Invalid data");
            }
        }
        return identities;
    }

    toLocFeesView(fees: LocFees): LocFeesView {
        return {
            valueFee: fees.valueFee?.toString(),
            legalFee: fees.legalFee?.toString(),
            collectionItemFee: fees.collectionItemFee?.toString(),
            tokensRecordFee: fees.tokensRecordFee?.toString(),
        }
    }

    toCollectionParamsView(collectionParams: CollectionParams | undefined): CollectionParamsView | undefined {
        if (!collectionParams) {
            return undefined;
        }
        const { lastBlockSubmission, maxSize, canUpload } = collectionParams;
        return {
            lastBlockSubmission: lastBlockSubmission?.toString(),
            maxSize,
            canUpload,
        }
    }
}

export function toUserIdentityView(userIdentity: UserIdentity | undefined): UserIdentityView | undefined {
    if (userIdentity === undefined) {
        return undefined;
    }
    return {
        firstName: userIdentity.firstName,
        lastName: userIdentity.lastName,
        email: userIdentity.email,
        phoneNumber: userIdentity.phoneNumber,
    }
}

export function toUserPostalAddressView(userPostalAddress: PostalAddress | undefined): PostalAddressView | undefined {
    if (userPostalAddress === undefined) {
        return undefined;
    }
    return {
        line1: userPostalAddress.line1,
        line2: userPostalAddress.line2,
        postalCode: userPostalAddress.postalCode,
        city: userPostalAddress.city,
        country: userPostalAddress.country,
    }
}

export function toFeesView(fees?: Fees): FeesView | undefined {
    if(fees) {
        return {
            inclusion: fees.inclusionFee.toString(),
            storage: fees.storageFee?.toString(),
            legal: fees.legalFee?.toString(),
            certificate: fees.certificateFee?.toString(),
            value: fees.valueFee?.toString(),
            collectionItem: fees.collectionItemFee?.toString(),
            tokensRecord: fees.tokensRecordFee?.toString(),
            total: fees.totalFee.toString(),
        };
    } else {
        return undefined;
    }
}

export function toLifecycleView(item: ItemLifecycle) {
    return {
        status: item.status,
        rejectReason: item.rejectReason,
        reviewedOn: item.reviewedOn?.toISOString(),
        addedOn: item.addedOn?.toISOString(),
        acknowledgedByOwnerOn: item.acknowledgedByOwnerOn?.toISOString(),
        acknowledgedByVerifiedIssuerOn: item.acknowledgedByVerifiedIssuerOn?.toISOString(),
    }
}
