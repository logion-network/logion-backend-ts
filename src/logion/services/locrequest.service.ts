import { injectable } from "inversify";
import { DefaultTransactional, requireDefined } from "@logion/rest-api-core";
import { LocRequestAggregateRoot, LocRequestRepository } from "../model/locrequest.model.js";

export abstract class LocRequestService {

    constructor(
        private locRequestRepository: LocRequestRepository,
    ) {}

    async addNewRequest(request: LocRequestAggregateRoot) {
        await this.locRequestRepository.save(request);
    }

    async update(requestId: string, mutator: (request: LocRequestAggregateRoot) => Promise<void>): Promise<LocRequestAggregateRoot> {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        await mutator(request);
        await this.locRequestRepository.save(request);
        return request;
    }

    async updateIfExists(requestId: string, mutator: (request: LocRequestAggregateRoot) => Promise<void>): Promise<LocRequestAggregateRoot | undefined> {
        const request = await this.locRequestRepository.findById(requestId);
        if(request) {
            await mutator(request);
            await this.locRequestRepository.save(request);
            return request;
        } else {
            return undefined;
        }
    }

    async deleteDraftRejectedOrAccepted(requestId: string, callback: (request: LocRequestAggregateRoot) => Promise<void>): Promise<LocRequestAggregateRoot> {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        await callback(request);
        await this.locRequestRepository.deleteDraftRejectedOrAccepted(request);
        return request;
    }

    async deleteOpen(requestId: string): Promise<void> {
        const request = requireDefined(await this.locRequestRepository.findById(requestId));
        await this.locRequestRepository.deleteOpen(request);
    }
}

@injectable()
export class TransactionalLocRequestService extends LocRequestService {

    constructor(
        locRequestRepository: LocRequestRepository,
    ) {
        super(locRequestRepository);
    }

    @DefaultTransactional()
    override async addNewRequest(request: LocRequestAggregateRoot) {
        await super.addNewRequest(request);
    }

    @DefaultTransactional()
    override async update(requestId: string, mutator: (request: LocRequestAggregateRoot) => Promise<void>): Promise<LocRequestAggregateRoot> {
        return super.update(requestId, mutator);
    }

    @DefaultTransactional()
    override async updateIfExists(requestId: string, mutator: (request: LocRequestAggregateRoot) => Promise<void>): Promise<LocRequestAggregateRoot | undefined> {
        return super.updateIfExists(requestId, mutator);
    }

    @DefaultTransactional()
    override async deleteDraftRejectedOrAccepted(requestId: string, callback: (request: LocRequestAggregateRoot) => Promise<void>): Promise<LocRequestAggregateRoot> {
        return super.deleteDraftRejectedOrAccepted(requestId, callback);
    }

    @DefaultTransactional()
    override async deleteOpen(requestId: string): Promise<void> {
        return super.deleteOpen(requestId);
    }
}

@injectable()
export class NonTransactionalLocRequestService extends LocRequestService {

    constructor(
        locRequestRepository: LocRequestRepository,
    ) {
        super(locRequestRepository);
    }
}
