import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import RoomRuntimeMemory from "./roomRuntimeMemory";

export default class RoomChangedSignal extends EncodableData
{
    roomRuntimeMemory: RoomRuntimeMemory;

    constructor(roomRuntimeMemory: RoomRuntimeMemory)
    {
        super();
        this.roomRuntimeMemory = roomRuntimeMemory;
    }

    encode(bufferState: BufferState)
    {
        this.roomRuntimeMemory.encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomRuntimeMemory = RoomRuntimeMemory.decode(bufferState) as RoomRuntimeMemory;
        return new RoomChangedSignal(roomRuntimeMemory);
    }
}
