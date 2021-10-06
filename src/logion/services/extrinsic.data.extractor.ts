import { injectable } from "inversify";
import moment, { Moment } from "moment";
import { BlockExtrinsics } from "./types/responses/Block";

import { JsonExtrinsic } from "./types/responses/Extrinsic";

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

    getDest(extrinsic: JsonExtrinsic): string | undefined {
        if(!('dest' in extrinsic.args)) {
            return undefined;
        } else {
            return extrinsic.args['dest'].toJSON().id;
        }
    }

    getValue(extrinsic: JsonExtrinsic): string {
        return extrinsic.args['value'] as string;
    }
}
