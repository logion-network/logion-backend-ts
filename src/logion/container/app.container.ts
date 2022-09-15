import { configureContainer, HealthService } from "@logion/rest-api-core";
import { Container } from 'inversify';

import { ProtectionRequestController } from '../controllers/protectionrequest.controller';
import { ProtectionRequestRepository, ProtectionRequestFactory } from '../model/protectionrequest.model';
import { TransactionRepository, TransactionFactory } from '../model/transaction.model';
import { SyncPointRepository, SyncPointFactory } from '../model/syncpoint.model';
import { BlockExtrinsicsService } from "../services/block.service";
import { BlockConsumer } from '../services/blockconsumption.service';
import { ExtrinsicDataExtractor } from '../services/extrinsic.data.extractor';
import { TransactionExtractor } from '../services/transaction.extractor';
import { TransactionSynchronizer } from '../services/transactionsync.service';
import { LocSynchronizer } from '../services/locsynchronization.service';
import { Scheduler } from '../scheduler/scheduler.service';
import { LocRequestController } from "../controllers/locrequest.controller";
import { LocRequestRepository, LocRequestFactory } from "../model/locrequest.model";
import { FileStorageService } from '../services/file.storage.service';
import { ProtectionSynchronizer } from '../services/protectionsynchronization.service';
import { ErrorService } from "../services/error.service";
import { TransactionController } from '../controllers/transaction.controller';
import { CollectionRepository, CollectionFactory } from "../model/collection.model";
import { NotificationService } from "../services/notification.service";
import { MailService } from "../services/mail.service";
import { DirectoryService } from "../services/directory.service";
import { VaultTransferRequestController } from '../controllers/vaulttransferrequest.controller';
import { VaultTransferRequestFactory, VaultTransferRequestRepository } from '../model/vaulttransferrequest.model';
import { LoFileFactory, LoFileRepository } from "../model/lofile.model";
import { SettingFactory, SettingRepository } from '../model/setting.model';
import { SettingController } from '../controllers/setting.controller';
import { CollectionService } from "../services/collection.service";
import { OwnershipCheckService } from '../services/ownershipcheck.service';
import { EtherscanService } from '../services/Etherscan.service';
import { RestrictedDeliveryService } from '../services/restricteddelivery.service';
import { ExifService } from '../services/exif.service';
import { UserIdentitySealService } from "../services/seal.service";
import { BackendHealthService } from "../services/health.service";

let container = new Container({ defaultScope: "Singleton", skipBaseClassChecks: true });
configureContainer(container);

container.bind(ProtectionRequestRepository).toSelf();
container.bind(ProtectionRequestFactory).toSelf();
container.bind(BlockExtrinsicsService).toSelf();
container.bind(ExtrinsicDataExtractor).toSelf();
container.bind(TransactionExtractor).toSelf();
container.bind(TransactionSynchronizer).toSelf();
container.bind(Scheduler).toSelf();
container.bind(TransactionRepository).toSelf();
container.bind(TransactionFactory).toSelf();
container.bind(SyncPointRepository).toSelf();
container.bind(SyncPointFactory).toSelf();
container.bind(LocRequestRepository).toSelf();
container.bind(LocRequestFactory).toSelf();
container.bind(FileStorageService).toSelf();
container.bind(LocSynchronizer).toSelf();
container.bind(BlockConsumer).toSelf();
container.bind(ProtectionSynchronizer).toSelf();
container.bind(ErrorService).toSelf();
container.bind(CollectionRepository).toSelf()
container.bind(CollectionFactory).toSelf()
container.bind(CollectionService).toSelf();
container.bind(NotificationService).toSelf()
container.bind(MailService).toSelf()
container.bind(DirectoryService).toSelf()
container.bind(VaultTransferRequestRepository).toSelf();
container.bind(VaultTransferRequestFactory).toSelf();
container.bind(LoFileFactory).toSelf();
container.bind(LoFileRepository).toSelf();
container.bind(SettingFactory).toSelf();
container.bind(SettingRepository).toSelf();
container.bind(EtherscanService).toSelf();
container.bind(OwnershipCheckService).toSelf();
container.bind(ExifService).toSelf();
container.bind(RestrictedDeliveryService).toSelf();
container.bind(UserIdentitySealService).toSelf();
container.bind(BackendHealthService).toSelf();
container.bind(HealthService).toService(BackendHealthService);

// Controllers are stateful so they must not be injected with singleton scope
container.bind(LocRequestController).toSelf().inTransientScope();
container.bind(ProtectionRequestController).toSelf().inTransientScope();
container.bind(TransactionController).toSelf().inTransientScope();
container.bind(VaultTransferRequestController).toSelf().inTransientScope();
container.bind(SettingController).toSelf().inTransientScope();

export { container as AppContainer };
