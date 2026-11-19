import Room from "../types/room";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableArray from "../../networking/types/encodableArray";
import EncodableByteString from "../../networking/types/encodableByteString";

export default class RoomRuntimeMemory extends EncodableData
{
    room: Room;
    participantUserNameByID: { [userID: string]: string };
    lastSavedTimeInMillis: number;

    constructor(room: Room, participantUserNameByID: { [userID: string]: string })
    {
        super();
        this.room = room;
        this.participantUserNameByID = participantUserNameByID;
        this.lastSavedTimeInMillis = Date.now();
    }

    encode(bufferState: BufferState)
    {
        this.room.encodeWithParams(bufferState, this.participantUserNameByID);

        new EncodableArray( // Encode participantUserIDs
            Object.keys(this.participantUserNameByID).map(x => new EncodableByteString(x)),
            65535
        ).encode(bufferState);
        new EncodableArray( // Encode participantUserNames
            Object.values(this.participantUserNameByID).map(x => new EncodableByteString(x)),
            65535
        ).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const room = Room.decode(bufferState) as Room;

        const participantUserIDs = (EncodableArray.decodeWithParams(bufferState, EncodableByteString.decode, 65535) as EncodableArray)
            .arr.map(x => (x as EncodableByteString).str);
        const participantUserNames = (EncodableArray.decodeWithParams(bufferState, EncodableByteString.decode, 65535) as EncodableArray)
            .arr.map(x => (x as EncodableByteString).str);
        
        const participantUserNameByID: { [userID: string]: string } = {};
        for (let i = 0; i < participantUserIDs.length; ++i)
            participantUserNameByID[participantUserIDs[i]] = participantUserNames[i];

        return new RoomRuntimeMemory(room, participantUserNameByID);
    }
}
