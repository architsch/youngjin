import ObjectServerRecord from "../../shared/object/objectServerRecord";
import RoomServerRecord from "../../shared/room/roomServerRecord";
import RoomMaps from "./roomMaps";

const roomServerRecords: {[roomName: string]: RoomServerRecord} = {};

const RoomManager =
{
    loadRoom: async (roomName: string): Promise<RoomServerRecord> =>
    {
        if (roomServerRecords[roomName] != undefined)
            throw new Error(`RoomServerRecord already exists (roomName = ${roomName})`);

        const roomServerRecord: RoomServerRecord = {
            roomName,
            roomMap: RoomMaps[roomName],
            participantUserNames: {},
            objectServerRecords: {},
        };
        roomServerRecords[roomName] = roomServerRecord;
        return roomServerRecord;
    },
    unloadRoom: async (roomName: string) =>
    {
        if (roomServerRecords[roomName] == undefined)
            throw new Error(`RoomServerRecord doesn't exist (roomName = ${roomName})`);
    },
    getRoom: (roomName: string): RoomServerRecord =>
    {
        return roomServerRecords[roomName];
    },
    hasRoom: (roomName: string): boolean =>
    {
        return roomServerRecords[roomName] != undefined;
    },
    addUserToRoom: (roomName: string, userName: string) =>
    {
        const roomServerRecord = roomServerRecords[roomName];
        if (roomServerRecord == undefined)
        {
            console.error(`RoomServerRecord doesn't exist (roomName = ${roomName})`);
            return;
        }
        if (roomServerRecord.participantUserNames[userName] != undefined)
        {
            console.error(`User is already registered (roomName = ${roomName}, userName = ${userName})`);
            return;
        }
        roomServerRecord.participantUserNames[userName] = true;
    },
    removeUserFromRoom: (roomName: string, userName: string) =>
    {
        const roomServerRecord = roomServerRecords[roomName];
        if (roomServerRecord == undefined)
        {
            console.error(`RoomServerRecord doesn't exist (roomName = ${roomName})`);
            return;
        }
        if (roomServerRecord.participantUserNames[userName] == undefined)
        {
            console.error(`User not found (roomName = ${roomName}, userName = ${userName})`);
            return;
        }
        delete roomServerRecord.participantUserNames[userName];
    },
    objectIsSpawnedByUser: (roomName: string, userName: string, objectId: string): boolean =>
    {
        const roomServerRecord = roomServerRecords[roomName];
        if (roomServerRecord == undefined)
        {
            console.error(`RoomServerRecord doesn't exist (roomName = ${roomName})`);
            return false;
        }
        const objectServerRecord = roomServerRecord.objectServerRecords[objectId];
        if (objectServerRecord == undefined)
        {
            console.error(`ObjectServerRecord doesn't exist (roomName = ${roomName}, objectId = ${objectId})`);
            return false;
        }
        return objectServerRecord.objectSpawnParams.sourceUserName == userName;
    },
    getIdsOfObjectsSpawnedByUser: (roomName: string, userName: string): string[] =>
    {
        const roomServerRecord = roomServerRecords[roomName];
        if (roomServerRecord == undefined)
        {
            console.error(`RoomServerRecord doesn't exist (roomName = ${roomName})`);
            return [];
        }
        const ids: string[] = [];
        for (const [objectId, objectServerRecord] of Object.entries(roomServerRecord.objectServerRecords))
        {
            if (objectServerRecord.objectSpawnParams.sourceUserName == userName)
                ids.push(objectId);
        }
        return ids;
    },
    hasObject: (roomName: string, objectId: string): boolean =>
    {
        const roomServerRecord = roomServerRecords[roomName];
        if (roomServerRecord == undefined)
        {
            console.error(`RoomServerRecord doesn't exist (roomName = ${roomName})`);
            return false;
        }
        return roomServerRecord.objectServerRecords[objectId] != undefined;
    },
    addObject: (roomName: string, objectServerRecord: ObjectServerRecord) =>
    {
        const roomServerRecord = roomServerRecords[roomName];
        if (roomServerRecord == undefined)
        {
            console.error(`RoomServerRecord doesn't exist (roomName = ${roomName})`);
            return;
        }
        const objectId = objectServerRecord.objectSpawnParams.objectId;
        if (roomServerRecord.objectServerRecords[objectId] != undefined)
        {
            console.error(`ObjectServerRecord already exists (roomName = ${roomName}, objectId = ${objectId})`);
            return;
        }
        roomServerRecord.objectServerRecords[objectId] = objectServerRecord;
    },
    removeObject: (roomName: string, objectId: string) =>
    {
        const roomServerRecord = roomServerRecords[roomName];
        if (roomServerRecord == undefined)
        {
            console.error(`RoomServerRecord doesn't exist (roomName = ${roomName})`);
            return;
        }
        if (roomServerRecord.objectServerRecords[objectId] == undefined)
        {
            console.error(`ObjectServerRecord doesn't exist (roomName = ${roomName}, objectId = ${objectId})`);
            return;
        }
        delete roomServerRecord.objectServerRecords[objectId];
    },
    updateObjectTransform: (roomName: string, objectId: string,
        x: number, y: number, z: number, eulerX: number, eulerY: number, eulerZ: number) =>
    {
        const roomServerRecord = roomServerRecords[roomName];
        if (roomServerRecord == undefined)
        {
            console.error(`RoomServerRecord doesn't exist (roomName = ${roomName})`);
            return;
        }
        const objectServerRecord = roomServerRecord.objectServerRecords[objectId];
        if (objectServerRecord == undefined)
        {
            console.error(`ObjectServerRecord doesn't exist (roomName = ${roomName}, objectId = ${objectId})`);
            return;
        }
        const tr = objectServerRecord.objectSpawnParams.transform;
        tr.x = x;
        tr.y = y;
        tr.z = z;
        tr.eulerX = eulerX;
        tr.eulerY = eulerY;
        tr.eulerZ = eulerZ;
    },
}

export default RoomManager;