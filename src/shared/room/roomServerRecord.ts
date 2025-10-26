import ObjectServerRecord from "../object/objectServerRecord";
import Room from "./room";

export default interface RoomServerRecord
{
    room: Room;
    participantUserNames: { [userName: string]: boolean };
    objectServerRecords: {[objectId: string]: ObjectServerRecord};
}