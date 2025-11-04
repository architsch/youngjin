import RoomRuntimeMemory from "../room/types/roomRuntimeMemory";
import PersistentObjectEncoding from "./encoding/persistentObjectEncoding";
import PersistentObject from "./types/persistentObject";

const persistentObjects: {[roomID: string]: PersistentObject[]} = {};

const PersistentObjectManager =
{
    loadRoom: (roomRuntimeMemory: RoomRuntimeMemory): PersistentObject[] =>
    {
        const decodedPersistentObjects = PersistentObjectEncoding.decode(roomRuntimeMemory.room.encodedPersistentObjects);
        if (persistentObjects[roomRuntimeMemory.room.roomID] != undefined)
            throw new Error(`PersistentObjects already exists (roomID = ${roomRuntimeMemory.room.roomID})`);
        persistentObjects[roomRuntimeMemory.room.roomID] = decodedPersistentObjects;
        return decodedPersistentObjects;
    },
    unloadRoom: (roomID: string) =>
    {
        if (persistentObjects[roomID] == undefined)
            throw new Error(`PersistentObjects doesn't exist (roomID = ${roomID})`);
        delete persistentObjects[roomID];
    },
    getEncodedPersistentObjects: (roomID: string): ArrayBuffer =>
    {
        const objects = persistentObjects[roomID];
        if (objects == undefined)
            throw new Error(`PersistentObjects doesn't exist (roomID = ${roomID})`);
        return PersistentObjectEncoding.encode(objects);
    },
    getPersistentObjects: (roomID: string): PersistentObject[] =>
    {
        const objects = persistentObjects[roomID];
        if (objects == undefined)
            throw new Error(`PersistentObjects doesn't exist (roomID = ${roomID})`);
        return objects;
    },
}

export default PersistentObjectManager;