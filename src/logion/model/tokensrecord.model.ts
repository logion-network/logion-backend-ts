import {
    Entity,
    PrimaryColumn,
    Column,
    Repository,
    OneToMany,
    ManyToOne,
    JoinColumn,
    Index
} from "typeorm";
import moment, { Moment } from "moment";
import { injectable } from "inversify";

import { appDataSource } from "@logion/rest-api-core";
import { Child, saveChildren } from "./child.js";

export interface TokensRecordDescription {
    readonly collectionLocId: string;
    readonly recordId: string;
    readonly addedOn?: Moment;
    readonly files?: TokensRecordFileDescription[];
}

export interface TokensRecordFileDescription {
    readonly hash: string;
    readonly cid: string;
}

@Entity("tokens_record")
export class TokensRecordAggregateRoot {

    getDescription(): TokensRecordDescription {
        return {
            collectionLocId: this.collectionLocId!,
            recordId: this.recordId!,
            addedOn: moment(this.addedOn),
            files: this.files?.map(file => file.getDescription()) || []
        }
    }

    addFile(fileDescription: TokensRecordFileDescription): TokensRecordFile {
        const { hash, cid } = fileDescription
        const file = new TokensRecordFile();
        file.collectionLocId = this.collectionLocId;
        file.recordId = this.recordId;
        file.hash = hash;
        file.cid = cid;
        file.collectionItem = this;
        file._toAdd = true;
        this.files?.push(file);
        return file
    }

    setAddedOn(addedOn: Moment) {
        if(this.addedOn) {
            throw new Error("Already set");
        }
        this.addedOn = addedOn.toDate();
    }

    @PrimaryColumn({ type: "uuid", name: "collection_loc_id" })
    collectionLocId?: string;

    @PrimaryColumn({ name: "record_id" })
    recordId?: string;

    @OneToMany(() => TokensRecordFile, file => file.collectionItem, {
        eager: true,
        cascade: false,
        persistence: false
    })
    files?: TokensRecordFile[];

    @Column("timestamp without time zone", { name: "added_on", nullable: true })
    addedOn?: Date;

    hasFile(hash: string): boolean {
        return this.file(hash) !== undefined;
    }

    file(hash: string): TokensRecordFile | undefined {
        return this.files!.find(file => file.hash === hash)
    }

    getFile(hash: string): TokensRecordFile {
        return this.file(hash)!;
    }
}

@Entity("tokens_record_file")
export class TokensRecordFile extends Child {

    getDescription(): TokensRecordFileDescription {
        return {
            hash: this.hash!,
            cid: this.cid!,
        }
    }
    @PrimaryColumn({ type: "uuid", name: "collection_loc_id" })
    collectionLocId?: string;

    @PrimaryColumn({ name: "record_id" })
    recordId?: string;

    @PrimaryColumn({ name: "hash" })
    hash?: string;

    @Column({ length: 255 })
    cid?: string;

    @ManyToOne(() => TokensRecordAggregateRoot, request => request.files)
    @JoinColumn([
        { name: "collection_loc_id", referencedColumnName: "collectionLocId" },
        { name: "record_id", referencedColumnName: "recordId" },
    ])
    collectionItem?: TokensRecordAggregateRoot;

    addDeliveredFile(params: {
        deliveredFileHash: string,
        generatedOn: Moment,
        owner: string,
    }): TokensRecordFileDelivered {
        const { deliveredFileHash, generatedOn, owner } = params;
        const deliveredFile = new TokensRecordFileDelivered();

        deliveredFile.collectionLocId = this.collectionLocId;
        deliveredFile.recordId = this.recordId;
        deliveredFile.hash = this.hash;

        deliveredFile.deliveredFileHash = deliveredFileHash;
        deliveredFile.generatedOn = generatedOn.toDate();
        deliveredFile.owner = owner;

        deliveredFile.tokensRecordFile = this;
        deliveredFile._toAdd = true;
        this.delivered?.push(deliveredFile);
        return deliveredFile;
    }

    @OneToMany(() => TokensRecordFileDelivered, deliveredFile => deliveredFile.tokensRecordFile, {
        eager: true,
        cascade: false,
        persistence: false
    })
    delivered?: TokensRecordFileDelivered[];
}

@Entity("tokens_record_file_delivered")
@Index([ "collectionLocId", "recordId", "hash" ])
export class TokensRecordFileDelivered extends Child {

    @PrimaryColumn({ type: "uuid", name: "id", default: () => "gen_random_uuid()", generated: "uuid" })
    id?: string;

    @Column({ type: "uuid", name: "collection_loc_id" })
    collectionLocId?: string;

    @Column({ name: "record_id" })
    recordId?: string;

    @Column({ name: "hash" })
    hash?: string;

    @Column({ name: "delivered_file_hash", length: 255 })
    deliveredFileHash?: string;

    @Column("timestamp without time zone", { name: "generated_on", nullable: true })
    generatedOn?: Date;

    @Column({ length: 255 })
    owner?: string;

    @ManyToOne(() => TokensRecordFile, file => file.delivered)
    @JoinColumn([
        { name: "collection_loc_id", referencedColumnName: "collectionLocId" },
        { name: "record_id", referencedColumnName: "recordId" },
        { name: "hash", referencedColumnName: "hash" },
    ])
    tokensRecordFile?: TokensRecordFile;
}

@injectable()
export class TokensRecordRepository {

    constructor() {
        this.repository = appDataSource.getRepository(TokensRecordAggregateRoot);
        this.fileRepository = appDataSource.getRepository(TokensRecordFile);
        this.deliveredRepository = appDataSource.getRepository(TokensRecordFileDelivered);
    }

    readonly repository: Repository<TokensRecordAggregateRoot>;
    readonly fileRepository: Repository<TokensRecordFile>;
    readonly deliveredRepository: Repository<TokensRecordFileDelivered>;

    public async save(root: TokensRecordAggregateRoot): Promise<void> {
        await this.repository.save(root);
        await this.saveFiles(root);
    }

    private async saveFiles(root: TokensRecordAggregateRoot): Promise<void> {
        if(root.files) {
            await saveChildren({
                children: root.files,
                entityManager: this.repository.manager,
                entityClass: TokensRecordFile,
            });
            for(const file of root.files) {
                await this.saveDelivered(file);
            }
        }
    }

    private async saveDelivered(root: TokensRecordFile): Promise<void> {
        await saveChildren({
            children: root.delivered,
            entityManager: this.repository.manager,
            entityClass: TokensRecordFileDelivered,
        });
    }

    public async createIfNotExist(collectionLocId: string, recordId: string, creator: () => TokensRecordAggregateRoot): Promise<TokensRecordAggregateRoot> {
        const existingTokensRecord = await this.repository.manager.findOneBy(TokensRecordAggregateRoot, {
            collectionLocId,
            recordId
        });
        if (existingTokensRecord) {
            return existingTokensRecord;
        } else {
            const newTokensRecord = creator();
            await this.repository.manager.insert(TokensRecordAggregateRoot, newTokensRecord);
            return newTokensRecord;
        }
    }

    public async findBy(collectionLocId: string, recordId: string): Promise<TokensRecordAggregateRoot | null> {
        return this.repository.findOneBy({ collectionLocId, recordId })
    }

    public async findAllBy(collectionLocId: string): Promise<TokensRecordAggregateRoot[]> {
        const builder = this.repository.createQueryBuilder("record");
        builder.where("record.collection_loc_id = :collectionLocId", { collectionLocId });
        builder.orderBy("record.added_on", "DESC");
        return builder.getMany();
    }

    public async findLatestDelivery(query: { collectionLocId: string, recordId: string, fileHash: string }): Promise<TokensRecordFileDelivered | undefined> {
        const { collectionLocId, recordId, fileHash } = query;
        const deliveries = await this.findLatestDeliveries({ collectionLocId, recordId, fileHash, limit: 1 });
        const deliveriesList = deliveries[fileHash];
        if(deliveriesList) {
            return deliveriesList[0];
        } else {
            return undefined;
        }
    }

    public async findLatestDeliveries(query: { collectionLocId: string, recordId: string, fileHash?: string, limit?: number }): Promise<Record<string, TokensRecordFileDelivered[]>> {
        const { collectionLocId, recordId, fileHash, limit } = query;
        let builder = this.deliveredRepository.createQueryBuilder("delivery");
        builder.where("delivery.collection_loc_id = :collectionLocId", { collectionLocId });
        builder.andWhere("delivery.record_id = :recordId", { recordId });
        if(fileHash) {
            builder.andWhere("delivery.hash = :fileHash", { fileHash });
        }
        builder.orderBy("delivery.generated_on", "DESC");
        if(limit) {
            builder.limit(limit);
        }
        const deliveriesList = await builder.getMany();
        const deliveries: Record<string, TokensRecordFileDelivered[]> = {};
        for(const delivery of deliveriesList) {
            const hash = delivery.hash!;
            deliveries[hash] ||= [];
            const fileDeliveries = deliveries[hash];
            fileDeliveries.push(delivery);
        }
        return deliveries;
    }
}

@injectable()
export class TokensRecordFactory {

    newTokensRecord(params: TokensRecordDescription): TokensRecordAggregateRoot {
        const { collectionLocId, recordId, addedOn } = params;
        const item = new TokensRecordAggregateRoot()
        item.collectionLocId = collectionLocId;
        item.recordId = recordId;
        item.addedOn = addedOn?.toDate();
        item.files = [];
        return item;
    }
}
