import { injectable } from 'inversify';
import '../lib/polkadot/interfaces/augment-api';
import '../lib/polkadot/interfaces/augment-types';
import { ApiPromise, WsProvider } from '@polkadot/api';
import * as definitions from '../lib/polkadot/interfaces/definitions';
import { Log } from "../util/Log";

const { logger } = Log;

@injectable()
export class PolkadotService {

    async readyApi(): Promise<ApiPromise> {
        if (this._api === null) {
            this._api = await this._createApi();
        }
        return this._api;
    }

    private _api: ApiPromise | null = null;

    private async _createApi(): Promise<ApiPromise> {
        const wsProviderUrl = process.env.WS_PROVIDER_URL || 'ws://localhost:9944';
        logger.info("Connecting to node %s", wsProviderUrl);
        const wsProvider = new WsProvider(wsProviderUrl);
        const types = Object.values(definitions).reduce((res, { types }): object => ({ ...res, ...types }), {});
        return await ApiPromise.create({
            provider: wsProvider,
            types
        });
    }
}
