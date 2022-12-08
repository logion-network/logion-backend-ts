import { injectable } from "inversify";
import { LegalOfficer } from "../model/legalofficer.model";
import axios, { AxiosInstance } from "axios";
import { badRequest, AuthenticationSystemFactory } from "@logion/rest-api-core";
import { AuthorityService } from "@logion/authenticator";

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

    async get(address: string): Promise<LegalOfficer> {
        return await this.axios.get(`/api/legal-officer/${ address }`)
            .then(response => response.data);
    }

    async requireLegalOfficerAddressOnNode(address: string | undefined): Promise<string> {
        if (!address) {
            throw badRequest("Missing Legal Officer address")
        }
        if (await this.isLegalOfficerAddressOnNode(address)) {
            return address;
        } else {
            throw badRequest(`Address ${ address } is not the one of a Legal Officer on this node.`)
        }
    }

    async isLegalOfficerAddressOnNode(address: string): Promise<boolean> {
        const authorityService = await this.authorityService;
        return (await authorityService.isLegalOfficerOnNode(address))
    }
}
