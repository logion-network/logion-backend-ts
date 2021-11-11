import { injectable } from "inversify";
import moment, { Moment } from "moment";
import { BlockExtrinsics } from "./types/responses/Block";

import { JsonExtrinsic } from "./types/responses/Extrinsic";
import { JsonCall, JsonArgs } from "./call";

@injectable()
export class ExtrinsicDataExtractor {

    getBlockTimestamp(block: BlockExtrinsics): Moment | undefined {
        for (let index = 0; index < block.extrinsics.length; index++) {
            const extrinsic = block.extrinsics[index];
            if (extrinsic.method.pallet === "timestamp") {
                return this.getTimestamp(extrinsic);
            }
        }
    }

    getTimestamp(extrinsic: JsonExtrinsic): Moment {
        const epochMilli = BigInt(extrinsic.args['now'].toString());
        const epochSec = Number(epochMilli / 1000n);
        return moment.unix(epochSec);
    }

    getDest(extrinsicOrCall: { args: JsonArgs } ): string | undefined {
        if(!('dest' in extrinsicOrCall.args)) {
            return undefined;
        } else {
            return extrinsicOrCall.args['dest'].toJSON().id;
        }
    }

    getValue(extrinsicOrCall: { args: JsonArgs } ): string {
        return extrinsicOrCall.args['value'] as string;
    }

    getCall(extrinsic: JsonExtrinsic): JsonCall {
        return extrinsic.args['call'] as JsonCall;
    }

    getAccount(extrinsic: JsonExtrinsic): string | undefined {
        if(!('account' in extrinsic.args)) {
            return undefined;
        } else {
            return extrinsic.args['account'].toString()
        }
    }
}
