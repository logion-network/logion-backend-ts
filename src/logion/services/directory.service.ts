import { injectable } from "inversify";
import {
    LegalOfficerDescription,
    LegalOfficerRepository,
    LegalOfficerAggregateRoot
} from "../model/legalofficer.model.js";
import { badRequest, AuthenticationSystemFactory, requireDefined, DefaultTransactional } from "@logion/rest-api-core";
import { AuthorityService } from "@logion/authenticator";
import { ValidAccountId } from "@logion/node-api";

export abstract class DirectoryService {

    private readonly authorityService: Promise<AuthorityService>;

    constructor(
        private authenticationSystemFactory: AuthenticationSystemFactory,
        private legalOfficerRepository: LegalOfficerRepository,
) {
        const authenticationSystem = this.authenticationSystemFactory.authenticationSystem();
        this.authorityService = authenticationSystem.then(system => system.authorityService);
    }

    async createOrUpdateLegalOfficer(legalOfficer: LegalOfficerAggregateRoot): Promise<void> {
        await this.legalOfficerRepository.save(legalOfficer);
    }

    async get(account: ValidAccountId): Promise<LegalOfficerDescription> {
        const legalOfficer = requireDefined(
            await this.legalOfficerRepository.findByAccount(account),
            () => new Error(`Cannot find legal officer ${ account.address } in local database`)
        );
        return legalOfficer.getDescription()
    }

    async requireLegalOfficerAddressOnNode(address: string | undefined): Promise<ValidAccountId> {
        if (!address) {
            throw badRequest("Missing Legal Officer address")
        }
        const account = ValidAccountId.polkadot(address);
        if (await this.isLegalOfficerAddressOnNode(account)) {
            return account;
        } else {
            throw badRequest(`Address ${ address } is not the one of a Legal Officer on this node.`)
        }
    }

    async isLegalOfficerAddressOnNode(account: ValidAccountId): Promise<boolean> {
        const authorityService = await this.authorityService;
        return (await authorityService.isLegalOfficerOnNode(account))
    }
}

@injectable()
export class TransactionalDirectoryService extends DirectoryService {

    constructor(
        authenticationSystemFactory: AuthenticationSystemFactory,
        legalOfficerRepository: LegalOfficerRepository
    ) {
        super(authenticationSystemFactory, legalOfficerRepository);
    }

    @DefaultTransactional()
    async createOrUpdateLegalOfficer(legalOfficer: LegalOfficerAggregateRoot): Promise<void> {
        return super.createOrUpdateLegalOfficer(legalOfficer);
    }
}

@injectable()
export class NonTransactionalDirectoryService extends DirectoryService {

    constructor(
        authenticationSystemFactory: AuthenticationSystemFactory,
        legalOfficerRepository: LegalOfficerRepository
    ) {
        super(authenticationSystemFactory, legalOfficerRepository);
    }
}
