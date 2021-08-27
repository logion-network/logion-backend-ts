import { injectable } from 'inversify';
import { Entity, PrimaryColumn, Column, getRepository, Repository } from "typeorm";

export interface TransactionDescription {
    readonly from: string;
    readonly to: string | null;
    readonly transferValue: bigint;
    readonly tip: bigint;
    readonly fee: bigint;
    readonly reserved: bigint;
    readonly pallet: string;
    readonly method: string;
    readonly createdOn: string;
}

const AMOUNT_PRECISION = 50;

@Entity("transaction")
export class TransactionAggregateRoot {

    getDescription(): TransactionDescription {
        return {
            from: this.from!,
            to: this.to || null,
            transferValue: BigInt(this.transferValue || "0"),
            tip: BigInt(this.tip || "0"),
            fee: BigInt(this.fee || "0"),
            reserved: BigInt(this.reserved || "0"),
            pallet: this.pallet!,
            method: this.method!,
            createdOn: this.createdOn!,
        };
    }

    @PrimaryColumn("bigint", {name: "block_number"})
    blockNumber?: string;

    @PrimaryColumn("integer", {name: "extrinsic_index"})
    extrinsicIndex?: number;

    @Column({name: "from_address", length: 255})
    from?: string;

    @Column("varchar", {name: "to_address", length: 255, nullable: true})
    to?: string | null;

    @Column("numeric", {name: "transfer_value", precision: AMOUNT_PRECISION})
    transferValue?: string;

    @Column("numeric", {precision: AMOUNT_PRECISION})
    tip?: string;

    @Column("numeric", {precision: AMOUNT_PRECISION})
    fee?: string;

    @Column("numeric", {precision: AMOUNT_PRECISION})
    reserved?: string;

    @Column()
    pallet?: string;

    @Column()
    method?: string;

    @Column({name: "created_on"})
    createdOn?: string;
}

@injectable()
export class TransactionRepository {

    constructor() {
        this.repository = getRepository(TransactionAggregateRoot);
    }

    readonly repository: Repository<TransactionAggregateRoot>;

    public findById(id: string): Promise<TransactionAggregateRoot | undefined> {
        return this.repository.findOne(id);
    }

    public async save(root: TransactionAggregateRoot): Promise<void> {
        await this.repository.save(root);
    }

    async findByAddress(address: string): Promise<TransactionAggregateRoot[]> {
        let builder = this.repository.createQueryBuilder("transaction");
        builder.where("transaction.from_address = :address", { address });
        builder.orWhere("transaction.to_address = :address", { address });
        builder.orderBy("transaction.block_number", "DESC");
        builder.addOrderBy("transaction.extrinsic_index", "DESC");
        return builder.getMany();
    }

    async deleteAll(): Promise<void> {
        return this.repository.clear();
    }
}

@injectable()
export class TransactionFactory {

    newTransaction(params: {
        blockNumber: bigint,
        extrinsicIndex: number,
        description: TransactionDescription
    }): TransactionAggregateRoot {
        const { blockNumber, extrinsicIndex } = params;
        var transaction = new TransactionAggregateRoot();
        transaction.blockNumber = blockNumber.toString();
        transaction.extrinsicIndex = extrinsicIndex;

        const { description } = params;
        transaction.from = description.from;
        transaction.to = description.to;
        transaction.transferValue = description.transferValue.toString();
        transaction.tip = description.tip.toString();
        transaction.fee = description.fee.toString();
        transaction.reserved = description.reserved.toString();
        transaction.pallet = description.pallet;
        transaction.method = description.method;
        transaction.createdOn = description.createdOn;

        return transaction;
    }
}
