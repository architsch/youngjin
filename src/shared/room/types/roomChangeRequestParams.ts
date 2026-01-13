import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableRaw4ByteNumber from "../../networking/types/encodableRaw4ByteNumber";

export default class RoomChangeRequestParams extends EncodableData
{
    roomID: number;

    constructor(roomID: number)
    {
        super();
        this.roomID = roomID;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRaw4ByteNumber(this.roomID).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableRaw4ByteNumber.decode(bufferState) as EncodableRaw4ByteNumber).n;
        return new RoomChangeRequestParams(roomID);
    }
}