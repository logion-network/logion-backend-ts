import { injectable } from "inversify";
import { Log, PolkadotService } from "@logion/rest-api-core";
import { ApiPromise } from "@polkadot/api";

const { logger } = Log;

@injectable()
export class ErrorService {
    constructor( private polkadotService: PolkadotService ) {}

    async findError(module: Module | null): Promise<Error> {
        const api = await this.polkadotService.readyApi();
        return this.findErrorWithApi(api, module);
    }

    findErrorWithApi(api: ApiPromise, module: Module | null): Error {
        if (module) {
            const errorNumber = parseInt(module.error) >> 24
            try {
                const metaError = api.registry.findMetaError(new Uint8Array([ module.index, errorNumber ]));
                if (metaError) {
                    return {
                        section: metaError.section,
                        name: metaError.name,
                        details: metaError.docs.join(', ').trim()
                    }
                } else {
                    return {
                        section: "unknown",
                        name: "Unknown",
                        details: `index:${ module.index } error:${ module.error }`
                    }
                }
            } catch (e) {
                logger.error("Failed to find meta error: ", e)
            }
        }
        return {
            section: "unknown",
            name: "Unknown",
            details: "An unknown error occurred"
        }
    }
}

export interface Module {
    readonly index: number
    readonly error: string
}

export interface Error {
    readonly section: string
    readonly name: string
    readonly details: string
}
