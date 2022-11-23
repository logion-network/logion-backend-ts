import { injectable } from "inversify";
import { DefaultTransactional, requireDefined } from "@logion/rest-api-core";
import { LoFileAggregateRoot, LoFileRepository } from "../model/lofile.model";

export abstract class LoFileService {

    constructor(
        private loFileRepository: LoFileRepository,
    ) {}

    async addLoFile(file: LoFileAggregateRoot) {
        this.loFileRepository.save(file);
    }

    async updateLoFile(id: string, mutator: (file: LoFileAggregateRoot) => Promise<void>) {
        const file = requireDefined(await this.loFileRepository.findById(id));
        await mutator(file);
        await this.loFileRepository.save(file);
        return file;
    }
}

@injectable()
export class NonTransactionalLoFileService extends LoFileService {

    constructor(
        loFileRepository: LoFileRepository,
    ) {
        super(loFileRepository);
    }
}

@injectable()
export class TransactionalLoFileService extends LoFileService {

    constructor(
        loFileRepository: LoFileRepository,
    ) {
        super(loFileRepository);
    }

    @DefaultTransactional()
    override async addLoFile(file: LoFileAggregateRoot) {
        super.addLoFile(file);
    }

    @DefaultTransactional()
    async updateLoFile(id: string, mutator: (file: LoFileAggregateRoot) => Promise<void>) {
        return super.updateLoFile(id, mutator);
    }
}
