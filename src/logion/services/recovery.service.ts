import { injectable } from 'inversify';

import { PolkadotService } from './polkadot.service';

@injectable()
export class RecoveryService {

    constructor(private polkadotService: PolkadotService) {}

    async hasRecoveryConfig(address: string): Promise<boolean> {
        const api = await this.polkadotService.readyApi();
        const config = await api.query.recovery.recoverable(address);
        return config.isSome;
    }
}
