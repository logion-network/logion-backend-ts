import { injectable } from 'inversify';
import { LocRequestAggregateRoot, LocRequestRepository } from '../model/locrequest.model';
import { ExtrinsicDataExtractor } from "./extrinsic.data.extractor";
import { decimalToUuid } from '../lib/uuid';
import { JsonArgs } from './call';
import { JsonExtrinsic } from "./types/responses/Extrinsic";
import { Moment } from "moment";
import { Log } from "../util/Log";

const { logger } = Log;

@injectable()
export class LocSynchronizer {

    constructor(
        private extrinsicDataExtractor: ExtrinsicDataExtractor,
        private locRequestRepository: LocRequestRepository,
    ) {}

    async updateLocRequests(extrinsic: JsonExtrinsic, timestamp: Moment) {
        if (extrinsic.method.pallet === "logionLoc") {
            if (extrinsic.method.method === "createLoc") {
                const locId = this.extractLocId(extrinsic.args);
                await this.mutateLoc(locId, loc => loc.setLocCreatedDate(timestamp));
            } else if (extrinsic.method.method === "addMetadata") {
                const locId = this.extractLocId(extrinsic.args);
                const item = {
                    name: extrinsic.args['item'].name.toUtf8(),
                    value: extrinsic.args['item'].value.toUtf8(),
                    addedOn: timestamp,
                };
                await this.mutateLoc(locId, loc => loc.addMetadataItem(item));
            } else if (extrinsic.method.method === "addFile") {
                const locId = this.extractLocId(extrinsic.args);
                const hash = extrinsic.args['file'].get('hash').toHex();
                await this.mutateLoc(locId, loc => loc.setFileAddedOn(hash, timestamp));
            } else if (extrinsic.method.method === "addLink") {
                const locId = this.extractLocId(extrinsic.args);
                const link = {
                    target: decimalToUuid(extrinsic.args['link'].id.toString()),
                    addedOn: timestamp,
                };
                await this.mutateLoc(locId, loc => loc.addLink(link));
            } else if (extrinsic.method.method === "close") {
                const locId = this.extractLocId(extrinsic.args);
                await this.mutateLoc(locId, loc => loc.close(timestamp));
            } else if (extrinsic.method.method === "makeVoid" || extrinsic.method.method === "makeVoidAndReplace") {
                const locId = this.extractLocId(extrinsic.args);
                await this.mutateLoc(locId, loc => loc.voidLoc(timestamp));
            }
        }
    }

    private extractLocId(args: JsonArgs): string {
        return decimalToUuid(args['loc_id'].toString());
    }

    private async mutateLoc(locId: string, mutator: (loc: LocRequestAggregateRoot) => void) {
        const loc = await this.locRequestRepository.findById(locId);
        if(loc !== undefined) {
            logger.info("Mutating LOC %s : %s", locId, mutator)
            mutator(loc);
            await this.locRequestRepository.save(loc);
        }
    }
}
