import { injectable } from "inversify";
import { DefaultTransactional, PolkadotService, requireDefined } from "@logion/rest-api-core";
import { UUID, TypesTokensRecord, Adapters, TypesTokensRecordFile } from "@logion/node-api";
import { TokensRecordAggregateRoot, TokensRecordRepository } from "../model/tokensrecord.model.js";

export interface GetTokensRecordParams {
    collectionLocId: string,
    recordId: string,
}

export interface GetTokensRecordFileParams extends GetTokensRecordParams {
    hash: string
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
            recordId
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
        return record?.files.find(itemFile => itemFile.hash === hash);
    }
}

export abstract class TokensRecordService {

    constructor(
        private tokensRecordRepository: TokensRecordRepository,
    ) {}

    async createIfNotExist(collectionLocId: string, recordId: string, creator: () => TokensRecordAggregateRoot): Promise<TokensRecordAggregateRoot> {
        return await this.tokensRecordRepository.createIfNotExist(collectionLocId, recordId, creator);
    }

    async update(collectionLocId: string, recordId: string, mutator: (item: TokensRecordAggregateRoot) => Promise<void>): Promise<TokensRecordAggregateRoot> {
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
    async createIfNotExist(collectionLocId: string, recordId: string, creator: () => TokensRecordAggregateRoot): Promise<TokensRecordAggregateRoot> {
        return super.createIfNotExist(collectionLocId, recordId, creator);
    }

    @DefaultTransactional()
    async update(collectionLocId: string, recordId: string, mutator: (item: TokensRecordAggregateRoot) => Promise<void>): Promise<TokensRecordAggregateRoot> {
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
