import GameObject from "../object/types/gameObject";
import ObjectSpawnParams from "../../shared/object/types/objectSpawnParams";
import ObjectFactory from "./factories/objectFactory";
import App from "../app";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import ObjectTypeConfigMap from "../../shared/object/maps/objectTypeConfigMap";
import ObjectTransform from "../../shared/object/types/objectTransform";
import AsyncUtil from "../../shared/system/util/asyncUtil";
import SignalTypeConfigMap from "../../shared/networking/maps/signalTypeConfigMap";
import ObjectDespawnParams from "../../shared/object/types/objectDespawnParams";
import ObjectMessageParams from "../../shared/object/types/objectMessageParams";
import SpeechBubble from "./components/speechBubble";
import ObjectSyncParams from "../../shared/object/types/objectSyncParams";
import ObjectSyncReceiver from "./components/objectSyncReceiver";
import ObjectDesyncResolveParams from "../../shared/object/types/objectDesyncResolveParams";
import ObjectSyncEmitter from "./components/objectSyncEmitter";
import VoxelGameObject from "./types/voxelGameObject";
import DirUtil from "../../shared/math/util/dirUtil";
import { ObjectMetadataKey } from "../../shared/object/types/objectMetadataKey";
import { setObjectMetadataObservable } from "../../shared/system/sharedObservables";

const gameObjects: {[objectId: string]: GameObject} = {};
const updatableGameObjects: {[objectId: string]: GameObject} = {};
const playerByUserID: {[userID: string]: GameObject} = {};
const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");

const ObjectManager =
{
    getObjectById: (objectId: string): GameObject | undefined =>
    {
        return gameObjects[objectId];
    },
    getMyPlayer: (): GameObject | undefined =>
    {
        const user = App.getUser();
        if (user)
            return playerByUserID[user.id];
        console.error(`Failed to fetch the user data (env = ${JSON.stringify(App.getEnv())})`);
        return undefined;
    },
    update: (deltaTime: number) =>
    {
        for (const id in updatableGameObjects)
        {
            const components = updatableGameObjects[id].components;
            for (const name in components)
            {
                if (components[name].update)
                    components[name].update(deltaTime);
            }
        }
    },
    load: async (roomRuntimeMemory: RoomRuntimeMemory) =>
    {
        // Load voxels from the decoded voxelGrid
        const voxelTypeIndex = ObjectTypeConfigMap.getIndexByType("Voxel");
        for (const voxel of roomRuntimeMemory.room.voxelGrid.voxels)
        {
            const gameObject = ObjectFactory.createClientSideObject(
                roomRuntimeMemory.room.id,
                voxelTypeIndex,
                new ObjectTransform(
                    voxel.col + 0.5, 0, voxel.row + 0.5,
                    0, 0, 1
                )
            );
            const voxelGameObject = gameObject as VoxelGameObject;
            voxelGameObject.setVoxel(voxel);
            await ObjectManager.spawnObject(gameObject);
        };

        // Find the player's initial position for distance-based canvas loading order
        let playerX = 0, playerY = 0, playerZ = 0;
        for (const mem of Object.values(roomRuntimeMemory.objectRuntimeMemories))
        {
            if (mem.objectSpawnParams.objectTypeIndex === playerTypeIndex)
            {
                const t = mem.objectSpawnParams.transform;
                playerX = t.x;
                playerY = t.y;
                playerZ = t.z;
                break;
            }
        }

        // Load objects from the decoded persistentObjectGroup, sorted by distance
        // from the player so that canvas images load nearest-first.
        const persistentObjects = Object.values(roomRuntimeMemory.room.persistentObjectGroup.persistentObjectById);
        persistentObjects.sort((a, b) =>
        {
            const da = (a.x - playerX) ** 2 + (a.y - playerY) ** 2 + (a.z - playerZ) ** 2;
            const db = (b.x - playerX) ** 2 + (b.y - playerY) ** 2 + (b.z - playerZ) ** 2;
            return da - db;
        });
        for (const po of persistentObjects)
        {
            const dirVec = DirUtil.dir4ToVec3(po.dir);
            const objectSpawnParams = new ObjectSpawnParams(
                roomRuntimeMemory.room.id,
                "", // Persistent objects are not directly owned by anyone, so sourceUserID is empty.
                "", // Persistent objects are not directly owned by anyone, so sourceUserName is empty.
                po.objectTypeIndex,
                po.objectId,
                new ObjectTransform(po.x, po.y, po.z, dirVec.x, dirVec.y, dirVec.z),
                po.metadata
            );
            const gameObject = ObjectFactory.createServerSideObject(objectSpawnParams);
            await ObjectManager.spawnObject(gameObject);
        }

        // Load objects from objectRuntimeMemories
        for (const objectRuntimeMemory of Object.values(roomRuntimeMemory.objectRuntimeMemories))
        {
            if (objectRuntimeMemory.objectSpawnParams.objectTypeIndex == voxelTypeIndex)
                throw new Error(`Voxel object is not allowed to spawn via objectRuntimeMemories.`);
            const object = ObjectFactory.createServerSideObject(objectRuntimeMemory.objectSpawnParams);
            await ObjectManager.spawnObject(object);
        }
    },
    unload: async () =>
    {
        // Unload objects
        for (const key of Object.keys(gameObjects))
        {
            await ObjectManager.despawnObject(key);
            delete gameObjects[key];
        }
        for (const key of Object.keys(updatableGameObjects))
            delete updatableGameObjects[key];
        for (const key of Object.keys(playerByUserID))
            delete playerByUserID[key];
    },
    spawnObject: async (object: GameObject) =>
    {
        if (gameObjects[object.params.objectId] == undefined)
        {
            gameObjects[object.params.objectId] = object;

            if (object.params.objectTypeIndex === playerTypeIndex)
                playerByUserID[object.params.sourceUserID] = object;

            let updatable = false;
            for (const component of Object.values(object.components))
            {
                if (component.update)
                    updatable = true;
            }
            if (updatable)
                updatableGameObjects[object.params.objectId] = object;
            await object.onSpawn();
        }
        else
        {
            console.error(`Object (ID = ${object.params.objectId}) has already been spawned.`);
        }
    },
    despawnObject: async (objectId: string) =>
    {
        if (gameObjects[objectId] != undefined)
        {
            const object = gameObjects[objectId];
            await object.onDespawn();
            delete gameObjects[objectId];
            if (updatableGameObjects[object.params.objectId] != undefined)
                delete updatableGameObjects[object.params.objectId];
            if (object.params.objectTypeIndex === playerTypeIndex)
                delete playerByUserID[object.params.sourceUserID];
        }
        else
        {
            console.error(`Object (ID = ${objectId}) has already been despawned.`);
        }
    },
    // When the client receives an ObjectSpawnParams signal from the server,
    // the given object will spawn as soon as the room to which it belongs is available.
    onObjectSpawnReceived: async (params: ObjectSpawnParams) => {
        const success = await waitUntilSignalProcessingReady("objectSpawnParams",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == params.roomID);
        if (!success)
            return;
        const gameObject = ObjectFactory.createServerSideObject(params);
        await ObjectManager.spawnObject(gameObject);
    },
    // When the client receives an ObjectDespawnParams signal from the server,
    // the given object will despawn as soon as the room to which it belongs is available.
    onObjectDespawnReceived: async (params: ObjectDespawnParams) => {
        const success = await waitUntilSignalProcessingReady("objectDespawnParams",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == params.roomID);
        if (!success)
            return;
        await ObjectManager.despawnObject(params.objectId);
    },
    // When the client receives an ObjectMessageParams signal from the server,
    // the given message will be displayed as soon as the message's sender object is found.
    onObjectMessageReceived: async (params: ObjectMessageParams) => {
        const success = await waitUntilSignalProcessingReady("objectMessageParams",
            () => ObjectManager.getObjectById(params.senderObjectId) != undefined);
        if (!success)
            return;
        const senderObject = ObjectManager.getObjectById(params.senderObjectId)!;
        const speechBubble = senderObject.components.speechBubble as SpeechBubble;
        speechBubble.onObjectMessageReceived(params);
    },
    onObjectSyncReceived: async (params: ObjectSyncParams) => {
        const object = ObjectManager.getObjectById(params.objectId)!;
        if (object.components.objectSyncReceiver)
            (object.components.objectSyncReceiver as ObjectSyncReceiver).onObjectSyncReceived(params);
    },
    onObjectDesyncResolveReceived: async (params: ObjectDesyncResolveParams) => {
        const object = ObjectManager.getObjectById(params.objectId)!;
        if (object.components.objectSyncReceiver)
            (object.components.objectSyncReceiver as ObjectSyncReceiver).onObjectDesyncResolveReceived(params);
        if (object.components.objectSyncEmitter)
            (object.components.objectSyncEmitter as ObjectSyncEmitter).onObjectDesyncResolveReceived(params);
    },
}

setObjectMetadataObservable.addListener("objectManager", async (change: {objectId: string, key: ObjectMetadataKey, value: string}) => {
    const gameObject = ObjectManager.getObjectById(change.objectId);
    if (gameObject)
        gameObject.onSetMetadata(change.key, change.value);
    else
        console.error(`Object metadata is set, but the object is not found (objectId = ${change.objectId}, key = ${change.key}, value = ${change.value})`);
});

const waitUntilSignalProcessingReady = (signalType: string, successCond: () => boolean): Promise<boolean> =>
    AsyncUtil.waitUntilSuccess(successCond, SignalTypeConfigMap.getConfigByType(signalType).maxClientSideReceptionPeriod)

export default ObjectManager;