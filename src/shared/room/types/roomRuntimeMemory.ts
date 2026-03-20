import Room from "../types/room";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableArray from "../../networking/types/encodableArray";
import EncodableByteString from "../../networking/types/encodableByteString";

export default class RoomRuntimeMemory extends EncodableData
{
    room: Room;
    participantUserIDs: { [userID: string]: boolean };
    lastSavedTimeInMillis: number;

    constructor(room: Room, participantUserIDs: { [userID: string]: boolean })
    {
        super();
        this.room = room;
        this.participantUserIDs = participantUserIDs;
        this.lastSavedTimeInMillis = Date.now();
    }

    encode(bufferState: BufferState)
    {
        this.room.encode(bufferState);
        new EncodableArray(
            Object.keys(this.participantUserIDs).map(x => new EncodableByteString(x)),
            65535
        ).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const room = Room.decode(bufferState) as Room;

        const a1 = EncodableArray.decodeWithParams(bufferState, EncodableByteString.decode, 65535) as EncodableArray;
        const participantUserIDs: { [userID: string]: boolean } = {};
        for (const element of a1.arr)
        {
            participantUserIDs[(element as EncodableByteString).str] = true;
        }

        return new RoomRuntimeMemory(room, participantUserIDs);
    }
}
