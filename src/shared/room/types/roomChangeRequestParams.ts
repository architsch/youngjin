import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";

export default class RoomChangeRequestParams extends EncodableData
{
    roomID: string;

    constructor(roomID: string)
    {
        super();
        this.roomID = roomID;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        return new RoomChangeRequestParams(roomID);
    }
}