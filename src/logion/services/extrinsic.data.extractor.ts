import { injectable } from "inversify";
import moment, { Moment } from "moment";

import { JsonExtrinsic } from "./types/responses/Extrinsic";

@injectable()
export class ExtrinsicDataExtractor {

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
