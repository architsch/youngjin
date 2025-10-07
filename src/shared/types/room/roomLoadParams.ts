import ObjectRecord from "../object/objectRecord";

export default interface RoomLoadParams
{
    roomMap: string,
    objectRecords: {[objectId: string]: ObjectRecord},
}