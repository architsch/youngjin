import BufferState from "../../../networking/types/bufferState";
import EncodableByteString from "../../../networking/types/encodableByteString";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import { MAX_RESTRICTED_ZONES } from "../../../system/sharedConstants";
import RestrictedZone from "../restrictedZone";

// The room's restricted zones, all of them, as they are now.
//
// Every other voxel edit names the one thing it changed, because a room holds tens of thousands of
// them and sending the room would be absurd. A room holds a handful of zones, and the whole list
// fits in a few dozen bytes — so drawing one, dragging one, resizing one and taking one away are all
// sent as the same message, and none of them needs a way to name a zone. Two people editing the
// zones of the same room at once is then the last one to speak winning outright, rather than two
// half-applied edits meeting somewhere in the middle.
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

        // Capped rather than trusted: the count goes out in a single byte, so a list longer than the
        // room may hold must not be allowed to write a length that cannot be read back.
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
