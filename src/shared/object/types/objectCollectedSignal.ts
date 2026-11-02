import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";

// That someone has collected an object, sent to the whole room ahead of its removal, for each to show while it is still
// there: whoever collected it, in one way, and everyone else, in another (see ClientObjectManager). Unlike a removal, it is
// only ever a collecting.
export default class ObjectCollectedSignal extends EncodableData
{
    roomID: string;
    objectId: string;
    collectorUserID: string;

    constructor(roomID: string, objectId: string, collectorUserID: string)
    {
        super();
        this.roomID = roomID;
        this.objectId = objectId;
        this.collectorUserID = collectorUserID;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(this.objectId).encode(bufferState);
        new EncodableByteString(this.collectorUserID).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const collectorUserID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        return new ObjectCollectedSignal(roomID, objectId, collectorUserID);
    }
}
