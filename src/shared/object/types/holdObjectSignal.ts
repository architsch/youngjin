import BufferState from "../../networking/types/bufferState";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableData from "../../networking/types/encodableData";

// An admin taking hold of an object (selecting it in edit mode) or letting go of it: a helper stands still while held
// (see HelperAgentUtil).
export default class HoldObjectSignal extends EncodableData
{
    roomID: string;
    objectId: string;
    held: boolean;

    constructor(roomID: string, objectId: string, held: boolean)
    {
        super();
        this.roomID = roomID;
        this.objectId = objectId;
        this.held = held;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(this.objectId).encode(bufferState);
        bufferState.view[bufferState.byteIndex++] = this.held ? 1 : 0;
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const held = (bufferState.view[bufferState.byteIndex++] === 1);
        return new HoldObjectSignal(roomID, objectId, held);
    }
}
