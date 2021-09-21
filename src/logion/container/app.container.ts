import './inversify.decorate';
import { Container } from 'inversify';

import { JsonResponse } from '../middlewares/json.response';
import { ApplicationErrorController } from '../controllers/application.error.controller';

import { ProtectionRequestController } from '../controllers/protectionrequest.controller';
import { TokenizationRequestController } from '../controllers/tokenizationrequest.controller';

import { PolkadotService } from '../services/polkadot.service';
import { RecoveryService } from '../services/recovery.service';

import { ProtectionRequestRepository, ProtectionRequestFactory } from '../model/protectionrequest.model';
import { TokenizationRequestRepository, TokenizationRequestFactory } from '../model/tokenizationrequest.model';
import { TransactionRepository, TransactionFactory } from '../model/transaction.model';
import { SyncPointRepository, SyncPointFactory } from '../model/syncpoint.model';
import { BlockExtrinsicsService } from "../services/block.service";
import { FeesService } from "../services/fees.service";
import { SubkeyService } from '../services/subkey.service';
import { SignatureService } from '../services/signature.service';
import { ExtrinsicDataExtractor } from '../services/extrinsic.data.extractor';
import { TransactionExtractor } from '../sync/transaction.extractor';
import { TransactionSync } from '../sync/transactionsync.service';
import { Scheduler } from '../scheduler/scheduler.service';
import { AuthenticationController } from "../controllers/authentication.controller";
import { AuthenticationService, } from "../services/authentication.service";
import { SessionRepository, SessionFactory } from "../model/session.model";
import { LocRequestController } from "../controllers/locrequest.controller";
import { LocRequestRepository, LocRequestFactory } from "../model/locrequest.model";

let container = new Container({ defaultScope: "Singleton" });
container.bind(ApplicationErrorController).toSelf();
container.bind(AuthenticationController).toSelf();
container.bind(AuthenticationService).toSelf();
container.bind(SessionRepository).toSelf();
container.bind(SessionFactory).toSelf();
container.bind(JsonResponse).toSelf();
container.bind(ProtectionRequestController).toSelf();
container.bind(ProtectionRequestRepository).toSelf();
container.bind(ProtectionRequestFactory).toSelf();
container.bind(PolkadotService).toSelf();
container.bind(RecoveryService).toSelf();
container.bind(TokenizationRequestController).toSelf();
container.bind(TokenizationRequestRepository).toSelf();
container.bind(TokenizationRequestFactory).toSelf();
container.bind(BlockExtrinsicsService).toSelf();
container.bind(FeesService).toSelf();
container.bind(SubkeyService).toSelf();
container.bind(SignatureService).toSelf();
container.bind(ExtrinsicDataExtractor).toSelf();
container.bind(TransactionExtractor).toSelf();
container.bind(TransactionSync).toSelf();
container.bind(Scheduler).toSelf();
container.bind(TransactionRepository).toSelf();
container.bind(TransactionFactory).toSelf();
container.bind(SyncPointRepository).toSelf();
container.bind(SyncPointFactory).toSelf();
container.bind(LocRequestController).toSelf();
container.bind(LocRequestRepository).toSelf();
container.bind(LocRequestFactory).toSelf();

export { container as AppContainer };
