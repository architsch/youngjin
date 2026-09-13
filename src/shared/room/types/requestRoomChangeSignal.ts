import BufferState from "../../networking/types/bufferState";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableData from "../../networking/types/encodableData";

export default class RequestRoomChangeSignal extends EncodableData
{
    roomID: string;
    allowFallback: boolean;
    // Arrival door label in the destination room (set when travelling through a door); empty for the
    // room's default entrance (see SpawnHotspotUtil).
    destinationDoorLabel: string;

    constructor(roomID: string, allowFallback: boolean, destinationDoorLabel: string = "")
    {
        super();
        this.roomID = roomID;
        this.allowFallback = allowFallback;
        this.destinationDoorLabel = destinationDoorLabel;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        bufferState.view[bufferState.byteIndex++] = this.allowFallback ? 1 : 0;
        new EncodableByteString(this.destinationDoorLabel).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const allowFallback = (bufferState.view[bufferState.byteIndex++] === 1);
        const destinationDoorLabel = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        return new RequestRoomChangeSignal(roomID, allowFallback, destinationDoorLabel);
    }
}
