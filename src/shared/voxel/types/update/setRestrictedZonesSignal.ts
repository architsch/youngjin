import BufferState from "../../../networking/types/bufferState";
import EncodableByteString from "../../../networking/types/encodableByteString";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import { MAX_RESTRICTED_ZONES } from "../../../system/sharedConstants";
import RestrictedZone from "../restrictedZone";

// The room's full zone list. It's tiny, so every zone change sends the whole list (no zone ids needed),
// and concurrent editors resolve as last writer wins.
export default class SetRestrictedZonesSignal extends EncodableData
{
    roomID: string;
    restrictedZones: RestrictedZone[];

    constructor(roomID: string, restrictedZones: RestrictedZone[])
    {
        super();
        this.roomID = roomID;
        this.restrictedZones = restrictedZones;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);

        // Capped, since the count is a single byte.
        const numZones = Math.min(this.restrictedZones.length, MAX_RESTRICTED_ZONES);
        if (this.restrictedZones.length > MAX_RESTRICTED_ZONES)
        {
            console.error(`SetRestrictedZonesSignal :: Too many restricted zones to encode ` +
                `(${this.restrictedZones.length}, max ${MAX_RESTRICTED_ZONES})`);
        }
        new EncodableRawByteNumber(numZones).encode(bufferState);
        for (let i = 0; i < numZones; ++i)
            this.restrictedZones[i].encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;

        const numZones = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        if (numZones > MAX_RESTRICTED_ZONES)
            throw new Error(`Decoded restricted zone count is out of range (numZones = ${numZones})`);

        const restrictedZones = new Array<RestrictedZone>(numZones);
        for (let i = 0; i < numZones; ++i)
            restrictedZones[i] = RestrictedZone.decode(bufferState) as RestrictedZone;

        return new SetRestrictedZonesSignal(roomID, restrictedZones);
    }
}
