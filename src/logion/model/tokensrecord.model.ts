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
import { WhereExpressionBuilder } from "typeorm/query-builder/WhereExpressionBuilder.js";
import moment, { Moment } from "moment";
import { injectable } from "inversify";

import { appDataSource, requireDefined } from "@logion/rest-api-core";
import { Child, saveChildren } from "./child.js";
import { Hash } from "@logion/node-api";

export interface TokensRecordDescription {
    readonly collectionLocId: string;
    readonly recordId: Hash;
    readonly description?: string;
    readonly addedOn?: Moment;
    readonly files?: TokensRecordFileDescription[];
}

export interface TokensRecordFileDescription {
    readonly name?: string;
    readonly contentType?: string;
    readonly hash: Hash;
    readonly cid?: string;
}

@Entity("tokens_record")
export class TokensRecordAggregateRoot {

    getDescription(): TokensRecordDescription {
        return {
            collectionLocId: this.collectionLocId!,
            recordId: Hash.fromHex(this.recordId!),
            description: this.description,
            addedOn: moment(this.addedOn),
            files: this.files?.map(file => file.getDescription()) || []
        }
    }

    setFileCid(fileDescription: { hash: Hash, cid: string }) {
        const { hash, cid } = fileDescription;
        const file = this.file(hash);
        if(!file) {
            throw new Error(`No file with hash ${ hash }`);
        }
        file.setCid(cid);
    }

    confirm(addedOn: Moment) {
        if(this.addedOn) {
            throw new Error("Already confirmed");
        }
        this.addedOn = addedOn.toDate();
    }

    @PrimaryColumn({ type: "uuid", name: "collection_loc_id" })
    collectionLocId?: string;

    @PrimaryColumn({ name: "record_id" })
    recordId?: string;

    @OneToMany(() => TokensRecordFile, file => file.tokenRecord, {
        eager: true,
        cascade: false,
        persistence: false
    })
    files?: TokensRecordFile[];

    @Column("timestamp without time zone", { name: "added_on", nullable: true })
    addedOn?: Date;

    hasFile(hash: Hash): boolean {
        return this.file(hash) !== undefined;
    }

    file(hash: Hash): TokensRecordFile | undefined {
        return this.files!.find(file => file.hash === hash.toHex());
    }

    getFile(hash: Hash): TokensRecordFile {
        return this.file(hash)!;
    }

    @Column({ length: 4096, name: "description", nullable: true })
    description?: string;
}

@Entity("tokens_record_file")
export class TokensRecordFile extends Child {

    static from(description: TokensRecordFileDescription, root?: TokensRecordAggregateRoot): TokensRecordFile {
        if(!description.name || !description.contentType) {
            throw new Error("No name nor content type provided");
        }
        const file = new TokensRecordFile();
        file.name = description.name;
        file.contentType = description.contentType;
        file.hash = description.hash.toHex();

        if(root) {
            file.collectionLocId = root.collectionLocId;
            file.recordId = root.recordId;
            file.tokenRecord = root;
            file._toAdd = true;
        }

        return file;
    }

    getDescription(): TokensRecordFileDescription {
        return {
            hash: Hash.fromHex(this.hash!),
            name: this.name,
            contentType: this.contentType,
            cid: this.cid || undefined,
        }
    }

    @PrimaryColumn({ type: "uuid", name: "collection_loc_id" })
    collectionLocId?: string;

    @PrimaryColumn({ name: "record_id" })
    recordId?: string;

    @PrimaryColumn({ name: "hash" })
    hash?: string;

    @Column({ length: 255, name: "name", nullable: true })
    name?: string;

    @Column({ length: 255, name: "content_type", nullable: true })
    contentType?: string;

    setCid(cid: string) {
        if(this.cid) {
            throw new Error("File has already a CID");
        }
        this.cid = cid;
        this._toUpdate = true;
    }

    @Column("varchar", { length: 255, nullable: true })
    cid?: string | null;

    @ManyToOne(() => TokensRecordAggregateRoot, request => request.files)
    @JoinColumn([
        { name: "collection_loc_id", referencedColumnName: "collectionLocId" },
        { name: "record_id", referencedColumnName: "recordId" },
    ])
    tokenRecord?: TokensRecordAggregateRoot;

    addDeliveredFile(params: {
        deliveredFileHash: Hash,
        generatedOn: Moment,
        owner: string,
    }): TokensRecordFileDelivered {
        const { deliveredFileHash, generatedOn, owner } = params;
        const deliveredFile = new TokensRecordFileDelivered();

        deliveredFile.collectionLocId = this.collectionLocId;
        deliveredFile.recordId = this.recordId;
        deliveredFile.hash = this.hash;

        deliveredFile.deliveredFileHash = deliveredFileHash.toHex();
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
            const whereExpression: <E extends WhereExpressionBuilder>(sql: E, file: TokensRecordFile) => E = (sql, _file) => sql
                .where("collection_loc_id = :locId", { locId: root.collectionLocId })
                .andWhere("record_id = :recordId", { recordId: root.recordId });
            await saveChildren({
                children: root.files,
                entityManager: this.repository.manager,
                entityClass: TokensRecordFile,
                whereExpression,
                updateValuesExtractor: file => {
                    const values = { ...file };
                    delete values.delivered;
                    return values;
                }
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

    public async findBy(collectionLocId: string, recordId: Hash): Promise<TokensRecordAggregateRoot | null> {
        return this.repository.findOneBy({ collectionLocId, recordId: recordId.toHex() });
    }

    public async findAllBy(collectionLocId: string): Promise<TokensRecordAggregateRoot[]> {
        const builder = this.repository.createQueryBuilder("record")
            .leftJoinAndSelect("record.files", "file");
        builder.where("record.collection_loc_id = :collectionLocId", { collectionLocId });
        builder.orderBy("record.added_on", "DESC");
        return builder.getMany();
    }

    public async findLatestDelivery(query: { collectionLocId: string, recordId: Hash, fileHash: Hash }): Promise<TokensRecordFileDelivered | undefined> {
        const { collectionLocId, recordId, fileHash } = query;
        const deliveries = await this.findLatestDeliveries({ collectionLocId, recordId, fileHash, limit: 1 });
        const deliveriesList = deliveries[fileHash.toHex()];
        if(deliveriesList) {
            return deliveriesList[0];
        } else {
            return undefined;
        }
    }

    public async findLatestDeliveries(query: { collectionLocId: string, recordId: Hash, fileHash?: Hash, limit?: number }): Promise<Record<string, TokensRecordFileDelivered[]>> {
        const { collectionLocId, recordId, fileHash, limit } = query;
        let builder = this.deliveredRepository.createQueryBuilder("delivery");
        builder.where("delivery.collection_loc_id = :collectionLocId", { collectionLocId });
        builder.andWhere("delivery.record_id = :recordId", { recordId: recordId.toHex() });
        if(fileHash) {
            builder.andWhere("delivery.hash = :fileHash", { fileHash: fileHash.toHex() });
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

    public async findDeliveryByDeliveredFileHash(query: { collectionLocId: string, recordId: Hash, deliveredFileHash: Hash }): Promise<TokensRecordFileDelivered | null> {
        const { collectionLocId, recordId, deliveredFileHash } = query;
        return await this.deliveredRepository.findOneBy({
            collectionLocId,
            recordId: recordId.toHex(),
            deliveredFileHash: deliveredFileHash.toHex(),
        });
    }

    async delete(item: TokensRecordAggregateRoot): Promise<void> {
        if(item.addedOn) {
            throw new Error("Cannot delete already published item");
        }
        const criteria = {
            collectionLocId: requireDefined(item.collectionLocId),
            recordId: requireDefined(item.recordId),
        };
        await this.deliveredRepository.delete(criteria); // There should be none
        await this.fileRepository.delete(criteria);
        await this.repository.delete(criteria);
    }
}

@injectable()
export class TokensRecordFactory {

    newTokensRecord(params: TokensRecordDescription): TokensRecordAggregateRoot {
        const { collectionLocId, recordId } = params;
        const item = new TokensRecordAggregateRoot()
        item.collectionLocId = collectionLocId;
        item.recordId = recordId.toHex();
        item.description = params.description;
        item.files = params.files?.map(file => TokensRecordFile.from(file, item)) || [];
        return item;
    }
}
