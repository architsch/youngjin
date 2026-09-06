import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";

// Tells everyone standing in a room that its atmosphere has changed. The whole of it travels every
// time rather than the one setting that moved: it is a handful of characters, and a room whose
// lighting is being adjusted by two people at once should end up looking like one of the two rather
// than like neither.
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
