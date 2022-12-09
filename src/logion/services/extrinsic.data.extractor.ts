import { injectable } from "inversify";
import moment, { Moment } from "moment";

import { BlockExtrinsics } from "./types/responses/Block.js";
import { JsonExtrinsic } from "./types/responses/Extrinsic.js";
import { JsonCall, JsonArgs, asBigInt, asJsonCall, asJsonObject, asString } from "./call.js";

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
        const epochMilli = asBigInt(extrinsic.call.args['now']);
        const epochSec = Number(epochMilli / 1000n);
        return moment.unix(epochSec);
    }

    getDest(extrinsicOrCall: { args: JsonArgs } ): string | undefined {
        if(!('dest' in extrinsicOrCall.args)) {
            return undefined;
        } else {
            const dest = asJsonObject(extrinsicOrCall.args['dest']);
            return asString(dest.Id);
        }
    }

    getValue(extrinsicOrCall: { args: JsonArgs } ): bigint {
        return asBigInt(extrinsicOrCall.args['value']);
    }

    getCall(extrinsic: JsonExtrinsic): JsonCall {
        return asJsonCall(extrinsic.call.args['call']);
    }

    getAccount(extrinsic: JsonExtrinsic): string | undefined {
        if(!('account' in extrinsic.call.args)) {
            return undefined;
        } else {
            const account = asJsonObject(extrinsic.call.args['account']);
            return asString(account.Id);
        }
    }
}
