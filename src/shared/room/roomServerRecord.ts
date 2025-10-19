import ObjectServerRecord from "../object/objectServerRecord";

export default interface RoomServerRecord
{
    roomName: string,
    roomMap: string,
    participantUserNames: { [userName: string]: boolean },
    objectServerRecords: {[objectId: string]: ObjectServerRecord},
}