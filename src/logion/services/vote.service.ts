import { VoteRepository, VoteAggregateRoot } from "../model/vote.model.js";
import { injectable } from "inversify";
import { DefaultTransactional, requireDefined } from "@logion/rest-api-core";

export abstract class VoteService {

    protected constructor(
        private voteRepository: VoteRepository,
    ) {}

    async add(vote: VoteAggregateRoot) {
        await this.voteRepository.save(vote);
    }

    async update(voteId: string, mutator: (vote: VoteAggregateRoot) => Promise<void>) {
        const vote = requireDefined(await this.voteRepository.findByVoteId(voteId));
        await mutator(vote);
        await this.voteRepository.save(vote);
        return vote;
    }
}

@injectable()
export class NonTransactionalVoteService extends VoteService {

    constructor(voteRepository: VoteRepository) {
        super(voteRepository);
    }
}

@injectable()
export class TransactionalVoteService extends VoteService {

    constructor(voteRepository: VoteRepository) {
        super(voteRepository);
    }

    @DefaultTransactional()
    override async add(vote: VoteAggregateRoot): Promise<void> {
        await super.add(vote);
    }

    @DefaultTransactional()
    override async update(voteId: string, mutator: (vote: VoteAggregateRoot) => Promise<void>): Promise<VoteAggregateRoot> {
        return await super.update(voteId, mutator);
    }
}
