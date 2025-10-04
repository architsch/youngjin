import ObjectRecord from "./objectRecord";

export default interface WorldSyncParams
{
    objectRecords: {[objectId: string]: ObjectRecord},
}