import BufferState from "../../networking/types/bufferState";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableData from "../../networking/types/encodableData";

export default class RequestRoomChangeSignal extends EncodableData
{
    roomID: string;
    allowFallback: boolean;
    // Which door of the destination room the user means to arrive behind, named by its label. A door
    // leading somewhere is what names one, so that walking through a door in one room puts the user
    // behind the door that answers it in the next, rather than wherever that room's own way in
    // happens to be. Empty when the user simply asked for the room (see SpawnHotspotUtil).
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
