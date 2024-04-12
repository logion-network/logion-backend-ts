import { injectable } from 'inversify';
import { Entity, PrimaryColumn, Column, Repository } from "typeorm";
import { appDataSource } from "@logion/rest-api-core";
import { ChainType, Fees, ValidAccountId } from '@logion/node-api';
import { EmbeddableFees, NULL_FEES } from './fees.js';
import { Party, asParty } from '../services/transaction.vo.js';
import { Block, EmbeddableBlock } from './block.model.js';
import { DB_SS58_PREFIX } from "./supportedaccountid.model.js";

export type TransactionType = "EXTRINSIC"
    | "VAULT_OUT"
    | "LEGAL_FEE"
    | "STORAGE_FEE"
    | "CERTIFICATE_FEE"
    | "OTHER_FEES"
    | "VALUE_FEE"
    | "RESERVE"
    | "COLLECTION_ITEM_FEE"
    | "TOKENS_RECORD_FEE"
;

function asTransactionType(type?: string): TransactionType {
    if(type === "EXTRINSIC"
        || type === "LEGAL_FEE"
        || type === "VAULT_OUT"
        || type === "STORAGE_FEE"
        || type === "OTHER_FEES"
        || type === "VALUE_FEE"
        || type === "RESERVE"
        || type === "COLLECTION_ITEM_FEE"
        || type === "TOKENS_RECORD_FEE"
    ) {
        return type;
    } else {
        throw new Error(`Unexpected value ${type}`);
    }
}

export interface TransactionDescription {
    readonly id: string;
    readonly block: Block;
    readonly extrinsicIndex: number,
    readonly from: ValidAccountId;
    readonly to: ValidAccountId | null;
    readonly transferValue: bigint;
    readonly tip: bigint;
    readonly fees: Fees;
    readonly reserved: bigint;
    readonly pallet: string;
    readonly method: string;
    readonly createdOn: string;
    readonly error?: TransactionDescriptionError;
    readonly type: TransactionType;
    readonly hiddenFrom?: Party | null;
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
            block: this.block!.toBlock(),
            extrinsicIndex: this.extrinsicIndex!,
            from: ValidAccountId.polkadot(this.from!),
            to: this.to ? ValidAccountId.polkadot(this.to) : null,
            transferValue: BigInt(this.transferValue || "0"),
            tip: BigInt(this.tip || "0"),
            fees: this.fees?.getDescription() || NULL_FEES,
            reserved: BigInt(this.reserved || "0"),
            pallet: this.pallet!,
            method: this.method!,
            createdOn: this.createdOn!,
            error,
            type: asTransactionType(this.type),
            hiddenFrom: asParty(this.hiddenFrom),
        };
    }

    @PrimaryColumn({ type: "uuid", name: "id", default: () => "gen_random_uuid()", generated: "uuid" })
    id?: string;

    @Column(() => EmbeddableBlock, { prefix: "" })
    block?: EmbeddableBlock;

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

    @Column(() => EmbeddableFees, { prefix: ""} )
    fees?: EmbeddableFees;

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

    @Column({ name: "type", length: 255 })
    type?: string;

    @Column("varchar", { name: "hidden_from", length: 255, nullable: true })
    hiddenFrom?: string | null;
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

    async findBy(spec: { account: ValidAccountId, chainType: ChainType }): Promise<TransactionAggregateRoot[]> {
        const builder = this.repository.createQueryBuilder("transaction");
        const dbSpec = {
            chainType: spec.chainType,
            address: spec.account.getAddress(DB_SS58_PREFIX),
        }
        builder.where("(transaction.chain_type = :chainType AND transaction.from_address = :address AND (transaction.hidden_from IS NULL OR transaction.hidden_from <> 'FROM'))", dbSpec);
        builder.orWhere("(transaction.chain_type = :chainType AND transaction.to_address = :address AND transaction.successful IS TRUE AND (transaction.hidden_from IS NULL OR transaction.hidden_from <> 'TO'))", dbSpec);
        builder.orderBy("transaction.block_number", "DESC");
        builder.addOrderBy("transaction.extrinsic_index", "DESC");
        return builder.getMany();
    }
}

@injectable()
export class TransactionFactory {

    newTransaction(description: TransactionDescription): TransactionAggregateRoot {
        const { block, extrinsicIndex } = description;
        const transaction = new TransactionAggregateRoot();
        transaction.id = description.id;
        transaction.block = EmbeddableBlock.from(block);
        transaction.extrinsicIndex = extrinsicIndex;

        transaction.from = description.from.getAddress(DB_SS58_PREFIX);
        transaction.to = description.to !== null ? description.to.getAddress(DB_SS58_PREFIX) : null;
        transaction.transferValue = description.transferValue.toString();
        transaction.tip = description.tip.toString();

        transaction.fees = !description.error ?
            EmbeddableFees.allFees(description.fees) :
            EmbeddableFees.onlyInclusion(description.fees);

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

        transaction.type = description.type;
        transaction.hiddenFrom = description.hiddenFrom;

        return transaction;
    }
}
