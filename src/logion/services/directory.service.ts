import { injectable } from "inversify";
import { LegalOfficer } from "../model/legalofficer.model.js";
import axios, { AxiosInstance } from "axios";
import { badRequest, AuthenticationSystemFactory } from "@logion/rest-api-core";
import { AuthorityService } from "@logion/authenticator";
import { ValidAccountId } from "@logion/node-api";

@injectable()
export class DirectoryService {

    private readonly axios: AxiosInstance;
    private readonly authorityService: Promise<AuthorityService>;

    constructor(private authenticationSystemFactory: AuthenticationSystemFactory) {
        if (process.env.DIRECTORY_URL === undefined) {
            throw Error("Please set var DIRECTORY_URL");
        }
        this.axios = axios.create({ baseURL: process.env.DIRECTORY_URL });
        const authenticationSystem = this.authenticationSystemFactory.authenticationSystem();
        this.authorityService = authenticationSystem.then(system => system.authorityService);
    }

    async get(account: ValidAccountId): Promise<LegalOfficer> {
        return await this.axios.get(`/api/legal-officer/${ account.address }`)
            .then(response => response.data);
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
