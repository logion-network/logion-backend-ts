import { injectable } from "inversify";
import { DefaultTransactional, PolkadotService, requireDefined } from "@logion/rest-api-core";
import { UUID, TypesTokensRecord, Adapters, TypesTokensRecordFile, Hash } from "@logion/node-api";
import { TokensRecordAggregateRoot, TokensRecordRepository } from "../model/tokensrecord.model.js";
import { HexString } from "@polkadot/util/types";

export interface GetTokensRecordParams {
    collectionLocId: string,
    recordId: Hash,
}

export interface GetTokensRecordFileParams extends GetTokensRecordParams {
    hash: Hash;
}

@injectable()
export class LogionNodeTokensRecordService {

    constructor(
        private polkadotService: PolkadotService,
    ) {}

    async getTokensRecord(params: GetTokensRecordParams): Promise<TypesTokensRecord | undefined> {
        const { collectionLocId, recordId } = params;
        const api = await this.polkadotService.readyApi();
        const substrateObject = await api.polkadot.query.logionLoc.tokensRecordsMap(
            api.adapters.toNonCompactLocId(new UUID(collectionLocId)),
            api.adapters.toH256(recordId),
        );
        if(substrateObject.isSome) {
            return Adapters.toTokensRecord(substrateObject.unwrap());
        } else {
            return undefined;
        }
    }

    async getTokensRecordFile(params: GetTokensRecordFileParams): Promise<TypesTokensRecordFile | undefined> {
        const { hash } = params;
        const record = await this.getTokensRecord(params);
        return record?.files.find(itemFile => itemFile.hash.equalTo(hash));
    }
}

export abstract class TokensRecordService {

    constructor(
        private tokensRecordRepository: TokensRecordRepository,
    ) {}

    async addTokensRecord(item: TokensRecordAggregateRoot): Promise<void> {
        const previousItem = await this.tokensRecordRepository.findBy(
            requireDefined(item.collectionLocId),
            requireDefined(Hash.fromHex(item.recordId as HexString)),
        );
        if(previousItem) {
            throw new Error("Cannot replace existing item");
        }
        await this.tokensRecordRepository.save(item);
    }

    async cancelTokensRecord(item: TokensRecordAggregateRoot): Promise<void> {
        await this.tokensRecordRepository.delete(item);
    }

    async update(collectionLocId: string, recordId: Hash, mutator: (item: TokensRecordAggregateRoot) => Promise<void>): Promise<TokensRecordAggregateRoot> {
        const item = requireDefined(await this.tokensRecordRepository.findBy(collectionLocId, recordId));
        await mutator(item);
        await this.tokensRecordRepository.save(item);
        return item;
    }
}

@injectable()
export class TransactionalTokensRecordService extends TokensRecordService {

    constructor(
        tokensRecordRepository: TokensRecordRepository,
    ) {
        super(tokensRecordRepository);
    }

    @DefaultTransactional()
    async addTokensRecord(item: TokensRecordAggregateRoot): Promise<void> {
        await super.addTokensRecord(item);
    }

    @DefaultTransactional()
    async cancelTokensRecord(item: TokensRecordAggregateRoot): Promise<void> {
        await super.cancelTokensRecord(item);
    }

    @DefaultTransactional()
    async update(collectionLocId: string, recordId: Hash, mutator: (item: TokensRecordAggregateRoot) => Promise<void>): Promise<TokensRecordAggregateRoot> {
        return super.update(collectionLocId, recordId, mutator);
    }
}

@injectable()
export class NonTransactionalTokensRecordService extends TokensRecordService {

    constructor(
        tokensRecordRepository: TokensRecordRepository,
    ) {
        super(tokensRecordRepository);
    }
}
