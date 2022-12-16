import axios, { AxiosInstance, CreateAxiosDefaults } from "axios";
import { injectable } from "inversify";

@injectable()
export class AxiosFactory {

    create(config?: CreateAxiosDefaults): AxiosInstance {
        return axios.create(config);
    }
}
