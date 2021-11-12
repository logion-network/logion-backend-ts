import { injectable } from "inversify";
import { PolkadotService } from "./polkadot.service";
import { Log } from "../util/Log";

const { logger } = Log;

@injectable()
export class ErrorService {
    constructor( private polkadotService: PolkadotService ) {}

    async findError(module: Module | null): Promise<Error> {
        const api = await this.polkadotService.readyApi();
        if (module) {
            try {
                const metaError = api.registry.findMetaError(new Uint8Array([ module.index, module.error ]));
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
    readonly error: number
}

export interface Error {
    readonly section: string
    readonly name: string
    readonly details: string
}
