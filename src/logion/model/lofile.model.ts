import { Entity, Column, PrimaryColumn, getRepository, Repository } from "typeorm";
import { injectable } from "inversify";

@Entity("lo_file")
export class LoFileAggregateRoot {

    @PrimaryColumn({ length: 255 })
    id?: string

    @Column({ length: 255, name: "content_type" })
    contentType?: string;

    @Column("int4")
    oid?: number;

    update(params: { contentType: string, oid: number }) {
        this.contentType = params.contentType;
        this.oid = params.oid;
    }
}

export interface LoFileDescription {
    readonly id: string,
    readonly contentType: string,
    readonly oid: number,
}

@injectable()
export class LoFileRepository {

    constructor() {
        this.repository = getRepository(LoFileAggregateRoot);
    }

    readonly repository: Repository<LoFileAggregateRoot>;

    public async findById(id: string): Promise<LoFileAggregateRoot | undefined> {
        return this.repository.findOne(id)
    }

    public async save(root: LoFileAggregateRoot): Promise<void> {
        await this.repository.save(root)
    }
}

@injectable()
export class LoFileFactory {

    public newLoFile(description: LoFileDescription): LoFileAggregateRoot {
        const root = new LoFileAggregateRoot();
        root.id = description.id;
        root.contentType = description.contentType;
        root.oid = description.oid;
        return root;
    }
}
