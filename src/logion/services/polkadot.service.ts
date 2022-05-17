import { injectable } from 'inversify';
import { createKeyMulti, encodeAddress } from '@polkadot/util-crypto';
import { buildApi, LogionNodeApi } from '@logion/node-api';

@injectable()
export class PolkadotService {

    async readyApi(): Promise<LogionNodeApi> {
        if (this._api === null) {
            this._api = await buildApi(process.env.WS_PROVIDER_URL || 'ws://localhost:9944');
        }
        return this._api;
    }

    private _api: LogionNodeApi | null = null;

    getVaultAddress(signatories: string[]): string {
        const address = createKeyMulti(signatories, 2);
        return encodeAddress(address);
    }
}
