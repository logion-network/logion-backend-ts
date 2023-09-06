import { options } from "@astar-network/astar-api";
import { ApiPromise } from "@polkadot/api";
import { WsProvider } from "@polkadot/rpc-provider";
import { injectable } from 'inversify';
import { Abi, ContractPromise } from '@polkadot/api-contract';
import PSP34 from "./psp34.js";

// Source: https://github.com/w3f/PSPs/blob/master/PSPs/psp-34.md#types
export interface AstarTokenId {
    U8?: any;
    U16?: any;
    U32?: any;
    U64?: any;
    U128?: any;
    Bytes?: any;
}

export class AstarClient {

    constructor(api: ApiPromise, contract: ContractPromise) {
        this.api = api;
        this.contract = contract;
    }

    private api: ApiPromise;

    private contract: ContractPromise;

    async getOwnerOf(tokenId: AstarTokenId): Promise<string | undefined> {
        const gasLimit = this.api.registry.createType(
            "WeightV2",
            this.api.consts.system.blockWeights["maxBlock"],
        );

        const { result } = await this.contract.query["psp34::ownerOf"]("", { gasLimit }, tokenId);

        if (result.isErr) {
            let error = "";
            if (result.asErr.isModule) {
                const dispatchError = this.api.registry.findMetaError(result.asErr.asModule);
                error = dispatchError.docs.length ? dispatchError.docs.concat().toString() : dispatchError.name;
            } else {
                error = result.asErr.toString();
            }
            throw new Error(error);
          } else {
            const okResult = result.asOk;
            if (okResult.flags.isRevert) {
                throw new Error("Call was reverted");
            } else {
                const type = this.contract.abi.messages[0].returnType;
                const typeName = type?.lookupName || type?.type || "";
                const result = this.contract.abi.registry.createTypeUnsafe(typeName, [okResult.data]) as any;
                if(result.isOk) {
                    const account = result.asOk;
                    return account.toString();
                } else {
                    throw new Error(result.asErr.toString());
                }
            }
        }
    }

    async disconnect() {
        await this.api.disconnect();
    }
}

export type AstarApi = { api: ApiPromise, contract: ContractPromise };

export type AstarApiFactory = (endpoint: string, abiJson: Record<string, unknown>, contractId: string) => Promise<AstarApi>;

export class AstarService {

    constructor(apiFactory: AstarApiFactory) {
        this.apiFactory = apiFactory;
        this.endpoints = {
            astar: "",
            shibuya: "",
            shiden: ""
        };
        if(process.env.ASTAR_ENDPOINT) {
            this.endpoints.astar = process.env.ASTAR_ENDPOINT;
        }
        if(process.env.SHIBUYA_ENDPOINT) {
            this.endpoints.shibuya = process.env.SHIBUYA_ENDPOINT;
        }
        if(process.env.SHIDEN_ENDPOINT) {
            this.endpoints.shiden = process.env.SHIDEN_ENDPOINT;
        }
        this.abis = {
            psp34: PSP34
        };
    }

    private endpoints: Record<AstarNetwork, string>;

    private abis: Record<AstarTokenType, Record<string, unknown>>;

    private apiFactory: AstarApiFactory;

    async getClient(network: AstarNetwork, tokenType: AstarTokenType, contractId: string): Promise<AstarClient> {
        const endpoint = this.endpoints[network];
        const { api, contract } = await this.apiFactory(endpoint, this.abis[tokenType], contractId);
        return new AstarClient(api, contract);
    }
}

export async function buildReadyAstarApi(endpoint: string, abiJson: Record<string, unknown>, contractId: string): Promise<AstarApi> {
    const provider = new WsProvider(endpoint);
    const api = new ApiPromise(options({ provider }));
    await api.isReady;
    const abi = new Abi(abiJson, api.registry.getChainProperties());
    const contract = new ContractPromise(api, abi, contractId);
    return { api, contract };
}

export type AstarNetwork = "astar" | "shiden" | "shibuya";

export type AstarTokenType = "psp34";

@injectable()
export class ConnectedAstarService extends AstarService {

    constructor() {
        super(buildReadyAstarApi);
    }
}
