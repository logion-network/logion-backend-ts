import { injectable } from "inversify";
import { DefaultTransactional, requireDefined } from "@logion/rest-api-core";
import { LoFileAggregateRoot, LoFileRepository } from "../model/lofile.model.js";
import { LegalOfficerSettingId } from "../model/legalofficer.model.js";

export abstract class LoFileService {

    protected constructor(
        private loFileRepository: LoFileRepository,
    ) {}

    async addLoFile(file: LoFileAggregateRoot) {
        await this.loFileRepository.save(file);
    }

    async updateLoFile(params: LegalOfficerSettingId, mutator: (file: LoFileAggregateRoot) => Promise<void>) {
        const file = requireDefined(await this.loFileRepository.findById(params));
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
        await super.addLoFile(file);
    }

    @DefaultTransactional()
    async updateLoFile(params: LegalOfficerSettingId, mutator: (file: LoFileAggregateRoot) => Promise<void>) {
        return super.updateLoFile(params, mutator);
    }
}
