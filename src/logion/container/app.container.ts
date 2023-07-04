import { configureContainer, HealthService } from "@logion/rest-api-core";
import { Container } from 'inversify';

import { ProtectionRequestController } from '../controllers/protectionrequest.controller.js';
import { ProtectionRequestRepository, ProtectionRequestFactory } from '../model/protectionrequest.model.js';
import { TransactionRepository, TransactionFactory } from '../model/transaction.model.js';
import { SyncPointRepository, SyncPointFactory } from '../model/syncpoint.model.js';
import { BlockExtrinsicsService } from "../services/block.service.js";
import { BlockConsumer } from '../services/blockconsumption.service.js';
import { ExtrinsicDataExtractor } from '../services/extrinsic.data.extractor.js';
import { TransactionExtractor } from '../services/transaction.extractor.js';
import { TransactionSynchronizer } from '../services/transactionsync.service.js';
import { LocSynchronizer } from '../services/locsynchronization.service.js';
import { Scheduler } from '../scheduler/scheduler.service.js';
import { LocRequestController } from "../controllers/locrequest.controller.js";
import { LocRequestRepository, LocRequestFactory } from "../model/locrequest.model.js";
import { FileStorageService } from '../services/file.storage.service.js';
import { ProtectionSynchronizer } from '../services/protectionsynchronization.service.js';
import { TransactionController } from '../controllers/transaction.controller.js';
import { CollectionRepository, CollectionFactory } from "../model/collection.model.js";
import { NotificationService } from "../services/notification.service.js";
import { MailService } from "../services/mail.service.js";
import { DirectoryService } from "../services/directory.service.js";
import { VaultTransferRequestController } from '../controllers/vaulttransferrequest.controller.js';
import { VaultTransferRequestFactory, VaultTransferRequestRepository } from '../model/vaulttransferrequest.model.js';
import { LoFileFactory, LoFileRepository } from "../model/lofile.model.js";
import { SettingFactory, SettingRepository } from '../model/setting.model.js';
import { SettingController } from '../controllers/setting.controller.js';
import { CollectionService, LogionNodeCollectionService, TransactionalCollectionService } from "../services/collection.service.js";
import { OwnershipCheckService } from '../services/ownershipcheck.service.js';
import { AlchemyFactory, AlchemyService } from '../services/alchemy.service.js';
import { RestrictedDeliveryService } from '../services/restricteddelivery.service.js';
import { ExifService } from '../services/exif.service.js';
import { PersonalInfoSealService } from "../services/seal.service.js";
import { BackendHealthService } from "../services/health.service.js";
import { SingularService } from "../services/singular.service.js";
import { PrometheusService } from "../services/prometheus.service.js";
import { VerifiedIssuerController } from "../controllers/verifiedissuer.controller.js";
import { VerifiedIssuerSelectionFactory, VerifiedIssuerSelectionRepository } from "../model/verifiedissuerselection.model.js";
import { LocRequestAdapter } from "../controllers/adapters/locrequestadapter.js";
import { LocRequestService, TransactionalLocRequestService } from "../services/locrequest.service.js";
import { LoFileService, TransactionalLoFileService } from "../services/lofile.service.js";
import { ProtectionRequestService, TransactionalProtectionRequestService } from "../services/protectionrequest.service.js";
import { SettingService, TransactionalSettingService } from "../services/settings.service.js";
import { SyncPointService, TransactionalSyncPointService } from "../services/syncpoint.service.js";
import { TransactionalTransactionService, TransactionService } from "../services/transaction.service.js";
import { TransactionalVaultTransferRequestService, VaultTransferRequestService } from "../services/vaulttransferrequest.service.js";
import { TransactionalVerifiedIssuerSelectionService, VerifiedIssuerSelectionService } from "../services/verifiedissuerselection.service.js";
import { DisabledIdenfyService, EnabledIdenfyService, IdenfyService } from "../services/idenfy/idenfy.service.js";
import { ConfigController } from "../controllers/config.controller.js";
import { IdenfyController } from "../controllers/idenfy.controller.js";
import { AxiosFactory } from "../services/axiosfactory.service.js";
import { VoteController } from "../controllers/vote.controller.js";
import { VoteRepository, VoteFactory } from "../model/vote.model.js";
import { VoteService, TransactionalVoteService } from "../services/vote.service.js";
import { VoteSynchronizer } from "../services/votesynchronization.service.js";
import { TokensRecordController } from "../controllers/records.controller.js";
import { TokensRecordFactory, TokensRecordRepository } from "../model/tokensrecord.model.js";
import { LogionNodeTokensRecordService, TokensRecordService, TransactionalTokensRecordService } from "../services/tokensrecord.service.js";
import { LocAuthorizationService } from "../services/locauthorization.service.js";
import { SponsorshipService } from "../services/sponsorship.service.js";
import { MultiversxService } from "../services/multiversx.service.js";

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
container.bind(CollectionRepository).toSelf()
container.bind(CollectionFactory).toSelf()
container.bind(LogionNodeCollectionService).toSelf();
container.bind(NotificationService).toSelf()
container.bind(MailService).toSelf()
container.bind(DirectoryService).toSelf()
container.bind(VaultTransferRequestRepository).toSelf();
container.bind(VaultTransferRequestFactory).toSelf();
container.bind(LoFileFactory).toSelf();
container.bind(LoFileRepository).toSelf();
container.bind(SettingFactory).toSelf();
container.bind(SettingRepository).toSelf();
container.bind(AlchemyService).toSelf();
container.bind(AlchemyFactory).toSelf();
container.bind(OwnershipCheckService).toSelf();
container.bind(MultiversxService).toSelf();
container.bind(ExifService).toSelf();
container.bind(RestrictedDeliveryService).toSelf();
container.bind(PersonalInfoSealService).toSelf();
container.bind(BackendHealthService).toSelf();
container.bind(HealthService).toService(BackendHealthService);
container.bind(SingularService).toSelf();
container.bind(PrometheusService).toSelf();
container.bind(VerifiedIssuerSelectionFactory).toSelf();
container.bind(VerifiedIssuerSelectionRepository).toSelf();
container.bind(LocRequestAdapter).toSelf();
container.bind(LocRequestService).toService(TransactionalLocRequestService);
container.bind(TransactionalLocRequestService).toSelf();
container.bind(CollectionService).toService(TransactionalCollectionService);
container.bind(TransactionalCollectionService).toSelf();
container.bind(LoFileService).toService(TransactionalLoFileService);
container.bind(TransactionalLoFileService).toSelf();
container.bind(ProtectionRequestService).toService(TransactionalProtectionRequestService);
container.bind(TransactionalProtectionRequestService).toSelf();
container.bind(SettingService).toService(TransactionalSettingService);
container.bind(TransactionalSettingService).toSelf();
container.bind(SyncPointService).toService(TransactionalSyncPointService);
container.bind(TransactionalSyncPointService).toSelf();
container.bind(TransactionService).toService(TransactionalTransactionService);
container.bind(TransactionalTransactionService).toSelf();
container.bind(VaultTransferRequestService).toService(TransactionalVaultTransferRequestService);
container.bind(TransactionalVaultTransferRequestService).toSelf();
container.bind(VerifiedIssuerSelectionService).toService(TransactionalVerifiedIssuerSelectionService);
container.bind(TransactionalVerifiedIssuerSelectionService).toSelf();
if(process.env.IDENFY_API_KEY) {
    container.bind(EnabledIdenfyService).toSelf();
    container.bind(IdenfyService).toService(EnabledIdenfyService);
} else {
    container.bind(DisabledIdenfyService).toSelf();
    container.bind(IdenfyService).toService(DisabledIdenfyService);
}
container.bind(AxiosFactory).toSelf();
container.bind(VoteFactory).toSelf();
container.bind(VoteRepository).toSelf();
container.bind(VoteService).toService(TransactionalVoteService);
container.bind(TransactionalVoteService).toSelf();
container.bind(VoteSynchronizer).toSelf();
container.bind(TokensRecordRepository).toSelf()
container.bind(TokensRecordFactory).toSelf()
container.bind(LogionNodeTokensRecordService).toSelf();
container.bind(TokensRecordService).toService(TransactionalTokensRecordService);
container.bind(TransactionalTokensRecordService).toSelf();
container.bind(LocAuthorizationService).toSelf();
container.bind(SponsorshipService).toSelf();

// Controllers are stateful so they must not be injected with singleton scope
container.bind(LocRequestController).toSelf().inTransientScope();
container.bind(ProtectionRequestController).toSelf().inTransientScope();
container.bind(TransactionController).toSelf().inTransientScope();
container.bind(VaultTransferRequestController).toSelf().inTransientScope();
container.bind(SettingController).toSelf().inTransientScope();
container.bind(VerifiedIssuerController).toSelf().inTransientScope();
container.bind(ConfigController).toSelf().inTransientScope();
container.bind(IdenfyController).toSelf().inTransientScope();
container.bind(VoteController).toSelf().inTransientScope();
container.bind(TokensRecordController).toSelf().inTransientScope();

export { container as AppContainer };
