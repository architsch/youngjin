import ObjectRuntimeMemory from "../../object/types/objectRuntimeMemory";
import Room from "../types/room";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableArray from "../../networking/types/encodableArray";
import EncodableByteString from "../../networking/types/encodableByteString";

export default class RoomRuntimeMemory extends EncodableData
{
    room: Room;
    participantUserNames: { [userName: string]: boolean };
    objectRuntimeMemories: {[objectId: string]: ObjectRuntimeMemory};
    lastSavedTimeInMillis: number;

    constructor(room: Room, participantUserNames: { [userName: string]: boolean },
        objectRuntimeMemories: {[objectId: string]: ObjectRuntimeMemory})
    {
        super();
        this.room = room;
        this.participantUserNames = participantUserNames;
        this.objectRuntimeMemories = objectRuntimeMemories;
        this.lastSavedTimeInMillis = Date.now();
    }

    encode(bufferState: BufferState)
    {
        this.room.encode(bufferState);
        new EncodableArray(
            Object.keys(this.participantUserNames).map(x => new EncodableByteString(x)),
            65535
        ).encode(bufferState);
        new EncodableArray(
            Object.values(this.objectRuntimeMemories),
            65535
        ).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const room = Room.decode(bufferState) as Room;

        const a1 = EncodableArray.decodeWithParams(bufferState, EncodableByteString.decode, 65535) as EncodableArray;
        const participantUserNames: { [userName: string]: boolean } = {};
        for (const element of a1.arr)
        {
            participantUserNames[(element as EncodableByteString).str] = true;
        }

        const a2 = EncodableArray.decodeWithParams(bufferState, ObjectRuntimeMemory.decode, 65535) as EncodableArray;
        const objectRuntimeMemories: {[objectId: string]: ObjectRuntimeMemory} = {};
        for (const element of a2.arr)
        {
            const obj = (element as ObjectRuntimeMemory);
            objectRuntimeMemories[obj.objectSpawnParams.objectId] = obj;
        }

        return new RoomRuntimeMemory(room, participantUserNames, objectRuntimeMemories);
    }
}