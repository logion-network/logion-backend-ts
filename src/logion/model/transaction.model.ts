import { injectable } from 'inversify';
import { Entity, PrimaryColumn, Column, Repository } from "typeorm";

import { appDataSource } from '../app-datasource';

export interface TransactionDescription {
    readonly id: string;
    readonly blockNumber: bigint,
    readonly extrinsicIndex: number,
    readonly from: string;
    readonly to: string | null;
    readonly transferValue: bigint;
    readonly tip: bigint;
    readonly fee: bigint;
    readonly reserved: bigint;
    readonly pallet: string;
    readonly method: string;
    readonly createdOn: string;
    readonly error?: TransactionDescriptionError;
}

export interface TransactionDescriptionError {
    readonly section: string
    readonly name: string
    readonly details: string
}

const AMOUNT_PRECISION = 50;

@Entity("transaction")
export class TransactionAggregateRoot {

    getDescription(): TransactionDescription {

        let error: TransactionDescriptionError | undefined = undefined;
        if (this.errorSection && this.errorName && this.errorDetails) {
            error = { section: this.errorSection, name: this.errorName, details: this.errorDetails }
        }

        return {
            id: this.id!,
            blockNumber: BigInt(this.blockNumber!),
            extrinsicIndex: this.extrinsicIndex!,
            from: this.from!,
            to: this.to || null,
            transferValue: BigInt(this.transferValue || "0"),
            tip: BigInt(this.tip || "0"),
            fee: BigInt(this.fee || "0"),
            reserved: BigInt(this.reserved || "0"),
            pallet: this.pallet!,
            method: this.method!,
            createdOn: this.createdOn!,
            error
        };
    }

    @PrimaryColumn({ type: "uuid", name: "id", default: () => "gen_random_uuid()" })
    id?: string;

    @Column("bigint", {name: "block_number"})
    blockNumber?: string;

    @Column("integer", {name: "extrinsic_index"})
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

    @Column({ name: "created_on" })
    createdOn?: string;

    @Column("boolean", { default: true })
    successful?: boolean = true;

    @Column({ name: "error_section", nullable: true })
    errorSection?: string;

    @Column({ name: "error_name", nullable: true })
    errorName?: string;

    @Column({ name: "error_details", nullable: true })
    errorDetails?: string;

}

@injectable()
export class TransactionRepository {

    constructor() {
        this.repository = appDataSource.getRepository(TransactionAggregateRoot);
    }

    readonly repository: Repository<TransactionAggregateRoot>;

    public findById(id: string): Promise<TransactionAggregateRoot | null> {
        return this.repository.findOneBy({ id });
    }

    public async save(root: TransactionAggregateRoot): Promise<void> {
        await this.repository.save(root);
    }

    async findByAddress(address: string): Promise<TransactionAggregateRoot[]> {
        let builder = this.repository.createQueryBuilder("transaction");
        builder.where("transaction.from_address = :address", { address });
        builder.orWhere("(transaction.to_address = :address AND transaction.successful is true)", { address });
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

    newTransaction(description: TransactionDescription): TransactionAggregateRoot {
        const { blockNumber, extrinsicIndex } = description;
        let transaction = new TransactionAggregateRoot();
        transaction.id = description.id;
        transaction.blockNumber = blockNumber.toString();
        transaction.extrinsicIndex = extrinsicIndex;

        transaction.from = description.from;
        transaction.to = description.to;
        transaction.transferValue = description.transferValue.toString();
        transaction.tip = description.tip.toString();
        transaction.fee = description.fee.toString();
        transaction.reserved = description.reserved.toString();
        transaction.pallet = description.pallet;
        transaction.method = description.method;
        transaction.createdOn = description.createdOn;

        if (!description.error) {
            transaction.successful = true;
        } else {
            transaction.successful = false;
            transaction.errorSection = description.error.section;
            transaction.errorName = description.error.name;
            transaction.errorDetails = description.error.details;
        }
        return transaction;
    }
}
