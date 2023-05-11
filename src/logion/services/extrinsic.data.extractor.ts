import { injectable } from "inversify";
import moment, { Moment } from "moment";

import { BlockExtrinsics } from "./types/responses/Block.js";
import { JsonExtrinsic } from "./types/responses/Extrinsic.js";
import { TypesJsonCall, TypesJsonObject, Adapters } from "@logion/node-api";

@injectable()
export class ExtrinsicDataExtractor {

    getBlockTimestamp(block: BlockExtrinsics): Moment | undefined {
        for (let index = 0; index < block.extrinsics.length; index++) {
            const extrinsic = block.extrinsics[index];
            if (extrinsic.call.section === "timestamp") {
                return this.getTimestamp(extrinsic);
            }
        }
    }

    getTimestamp(extrinsic: JsonExtrinsic): Moment {
        const epochMilli = Adapters.asBigInt(extrinsic.call.args['now']);
        const epochSec = Number(epochMilli / 1000n);
        return moment.unix(epochSec);
    }

    getDest(extrinsicOrCall: { args: TypesJsonObject } ): string | undefined {
        if(!('dest' in extrinsicOrCall.args)) {
            return undefined;
        } else {
            const dest = Adapters.asJsonObject(extrinsicOrCall.args['dest']);
            return Adapters.asString(dest.Id);
        }
    }

    getValue(extrinsicOrCall: { args: TypesJsonObject } ): bigint {
        return Adapters.asBigInt(extrinsicOrCall.args['value']);
    }

    getCall(extrinsic: JsonExtrinsic): TypesJsonCall {
        return Adapters.asJsonCall(extrinsic.call.args['call']);
    }

    getAccount(extrinsic: JsonExtrinsic): string | undefined {
        if(!('account' in extrinsic.call.args)) {
            return undefined;
        } else {
            const account = Adapters.asJsonObject(extrinsic.call.args['account']);
            return Adapters.asString(account.Id);
        }
    }
}
