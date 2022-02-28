import { injectable } from "inversify";
import { LegalOfficer } from "../model/legalofficer.model";
import axios, { AxiosInstance } from "axios";

@injectable()
export class DirectoryService {

    private axios: AxiosInstance;

    constructor() {
        if (process.env.DIRECTORY_URL === undefined) {
            throw Error("Please set var DIRECTORY_URL");
        }
        this.axios = axios.create({ baseURL: process.env.DIRECTORY_URL });
    }

    async get(address: string): Promise<LegalOfficer> {
        return await this.axios.get(`/api/legal-officer/${ address }`)
            .then(response => response.data);
    }
}
