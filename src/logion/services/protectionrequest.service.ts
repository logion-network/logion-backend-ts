import { DefaultTransactional, requireDefined } from "@logion/rest-api-core";
import { injectable } from "inversify";
import { ProtectionRequestAggregateRoot, ProtectionRequestRepository } from "../model/protectionrequest.model";

export abstract class ProtectionRequestService {

    protected constructor(
        private protectionRequestRepository: ProtectionRequestRepository,
    ) {}

    async add(request: ProtectionRequestAggregateRoot) {
        await this.protectionRequestRepository.save(request);
    }

    async update(id: string, mutator: (request: ProtectionRequestAggregateRoot) => Promise<void>) {
        const request = requireDefined(await this.protectionRequestRepository.findById(id));
        await mutator(request);
        await this.protectionRequestRepository.save(request);
        return request;
    }
}

@injectable()
export class NonTransactionalProtectionRequestService extends ProtectionRequestService {

    constructor(
        protectionRequestRepository: ProtectionRequestRepository,
    ) {
        super(protectionRequestRepository);
    }
}

@injectable()
export class TransactionalProtectionRequestService extends ProtectionRequestService {

    constructor(
        protectionRequestRepository: ProtectionRequestRepository,
    ) {
        super(protectionRequestRepository);
    }

    @DefaultTransactional()
    override async add(request: ProtectionRequestAggregateRoot) {
        return super.add(request);
    }

    @DefaultTransactional()
    override async update(id: string, mutator: (request: ProtectionRequestAggregateRoot) => Promise<void>) {
        return super.update(id, mutator);
    }
}
