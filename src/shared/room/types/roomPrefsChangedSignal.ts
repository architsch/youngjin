import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";

// Broadcasts a room's full prefs (small, and concurrent editors converge on one whole setting).
export default class RoomPrefsChangedSignal extends EncodableData
{
    roomID: string;
    prefs: string;

    constructor(roomID: string, prefs: string)
    {
        super();
        this.roomID = roomID;
        this.prefs = prefs;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(this.prefs).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const prefs = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        return new RoomPrefsChangedSignal(roomID, prefs);
    }
}
