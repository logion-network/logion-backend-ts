import { Mock } from 'moq.ts';
import { PolkadotService } from '../../../src/logion/services/polkadot.service';
import { RecoveryService } from '../../../src/logion/services/recovery.service';
import { ApiPromise } from '@polkadot/api';
import { Option } from '@polkadot/types';
import { RecoveryConfig } from '@polkadot/types/interfaces/recovery';

describe('RecoveryService', () => {

    it('detects existing recovery config', async () => {
        givenExistingRecoveryConfig(true);
        await whenCheckRecoveryConfig();
        thenRecoveryConfigDetected(true);
    });

    const address = "ABC";

    function givenExistingRecoveryConfig(exists: boolean): void {
        polkadotService = new Mock<PolkadotService>();

        let polkadotApi = new Mock<ApiPromise>();
        let recoveryConfig = new Mock<Option<RecoveryConfig>>();
        recoveryConfig.setup(instance => instance.isSome)
            .returns(exists);
        polkadotApi.setup(instance => instance.query.recovery.recoverable(address))
            .returns(Promise.resolve(recoveryConfig.object()));

        polkadotService.setup(instance => instance.readyApi()).returns(Promise.resolve(polkadotApi.object()));
    }

    let polkadotService: Mock<PolkadotService>;

    async function whenCheckRecoveryConfig(): Promise<void> {
        let recoveryService = new RecoveryService(polkadotService.object());
        result = await recoveryService.hasRecoveryConfig(address);
    }

    let result: boolean;

    function thenRecoveryConfigDetected(expected: boolean): void {
        expect(result).toBe(expected);
    }

    it('detects non-existing recovery config', async () => {
        givenExistingRecoveryConfig(false);
        await whenCheckRecoveryConfig();
        thenRecoveryConfigDetected(false);
    });
});
