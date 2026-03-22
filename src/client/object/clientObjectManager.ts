import GameObject from "../object/types/gameObject";
import AddObjectSignal from "../../shared/object/types/addObjectSignal";
import ObjectFactory from "./factories/objectFactory";
import App from "../app";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import ObjectTypeConfigMap from "../../shared/object/maps/objectTypeConfigMap";
import ObjectTransform from "../../shared/object/types/objectTransform";
import AsyncUtil from "../../shared/system/util/asyncUtil";
import SignalTypeConfigMap from "../../shared/networking/maps/signalTypeConfigMap";
import RemoveObjectSignal from "../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../shared/object/types/setObjectMetadataSignal";
import ObjectMetadataEntryMap from "../../shared/object/maps/objectMetadataEntryMap";
import SetObjectTransformSignal from "../../shared/object/types/setObjectTransformSignal";
import PeriodicTransformReceiver from "./components/periodicTransformReceiver";
import PeriodicTransformEmitter from "./components/periodicTransformEmitter";
import VoxelGameObject from "./types/voxelGameObject";
import { ObjectMetadataKey } from "../../shared/object/types/objectMetadataKey";
import { setObjectMetadataObservable } from "../../shared/system/sharedObservables";
import { persistentObjectSelectionObservable } from "../system/clientObservables";
import PersistentObjectSelection from "../graphics/types/gizmo/persistentObjectSelection";
import ObjectUpdateUtil from "../../shared/object/util/objectUpdateUtil";
import Vec3 from "../../shared/math/types/vec3";

const gameObjects: {[objectId: string]: GameObject} = {};
const updatableGameObjects: {[objectId: string]: GameObject} = {};
const playerByUserID: {[userID: string]: GameObject} = {};
const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
const voxelTypeIndex = ObjectTypeConfigMap.getIndexByType("Voxel");

// IDs of objects that were speculatively spawned by the client before server confirmation
const speculativeAddObjectIds = new Set<string>();

const ClientObjectManager =
{
    speculativeAddObjectIds,
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
        for (const voxel of roomRuntimeMemory.room.voxelGrid.voxels)
        {
            const gameObject = ObjectFactory.createClientSideObject(
                roomRuntimeMemory.room.id,
                voxelTypeIndex,
                new ObjectTransform(
                    {x: voxel.col + 0.5, y: 0, z: voxel.row + 0.5},
                    {x: 0, y: 0, z: 1}
                )
            );
            const voxelGameObject = gameObject as VoxelGameObject;
            voxelGameObject.setVoxel(voxel);
            await ClientObjectManager.addObject(gameObject);
        };

        // Find the player's initial position for distance-based loading order
        let playerX = 0, playerY = 0, playerZ = 0;
        for (const obj of Object.values(roomRuntimeMemory.room.objectById))
        {
            if (obj.objectTypeIndex === playerTypeIndex)
            {
                const t = obj.transform;
                playerX = t.pos.x;
                playerY = t.pos.y;
                playerZ = t.pos.z;
                break;
            }
        }

        // Load all objects from room.objectById, sorted by distance
        // from the player so that canvas images load nearest-first.
        const objects = Object.values(roomRuntimeMemory.room.objectById);
        objects.sort((a, b) =>
        {
            const da = (a.transform.pos.x - playerX) ** 2 + (a.transform.pos.y - playerY) ** 2 + (a.transform.pos.z - playerZ) ** 2;
            const db = (b.transform.pos.x - playerX) ** 2 + (b.transform.pos.y - playerY) ** 2 + (b.transform.pos.z - playerZ) ** 2;
            return da - db;
        });
        for (const obj of objects)
        {
            if (obj.objectTypeIndex == voxelTypeIndex)
                throw new Error(`Voxel object is not allowed to spawn via objectById.`);
            const gameObject = ObjectFactory.createServerSideObject(obj);
            await ClientObjectManager.addObject(gameObject);
        }
    },
    unload: async () =>
    {
        // Unload objects
        for (const key of Object.keys(gameObjects))
        {
            await ClientObjectManager.removeObject(key);
            delete gameObjects[key];
        }
        for (const key of Object.keys(updatableGameObjects))
            delete updatableGameObjects[key];
        for (const key of Object.keys(playerByUserID))
            delete playerByUserID[key];
    },
    addObject: async (object: GameObject) =>
    {
        if (ObjectUpdateUtil.canAddObject(
            App.getCurrentRoom()!, object.params.objectTypeIndex,
            object.params.transform.pos, object.params.transform.dir,
            object.params.objectId))
        {
            ObjectUpdateUtil.addObject(
                App.getCurrentRoom()!, object.params.objectId,
                object.params.objectTypeIndex,
                object.params.transform.pos, object.params.transform.dir,
                object.params.metadata, object.params.sourceUserID,
                object.params.sourceUserName);
        }

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
    removeObject: async (objectId: string) =>
    {
        if (ObjectUpdateUtil.canRemoveObject(App.getCurrentRoom()!, objectId))
        {
            ObjectUpdateUtil.removeObject(App.getCurrentRoom()!, objectId);
        }

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
    setObjectTransform: (objectId: string, pos: Vec3, dir: Vec3, ignorePhysics: boolean): ObjectTransform =>
    {
        const result = ObjectUpdateUtil.setObjectTransform(
            App.getCurrentRoom()!, objectId, pos, dir, ignorePhysics);
        const object = ClientObjectManager.getObjectById(objectId)!;
        if (object)
        {
            if (object.components.periodicTransformReceiver)
                (object.components.periodicTransformReceiver as PeriodicTransformReceiver).setObjectTransform(result.transform);
            else
                object.setObjectTransform(result.transform.pos, result.transform.dir);
        }
        else
            console.error(`ClientObjectManager.setObjectTransform :: GameObject not found (objectId = ${objectId})`);
        return result.transform;
    },
    // When the client receives an AddObjectSignal from the server,
    // the given object will spawn as soon as the room to which it belongs is available.
    onAddObjectSignalReceived: async (params: AddObjectSignal) => {
        const success = await waitUntilSignalProcessingReady("addObjectSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == params.roomID);
        if (!success)
            return;

        const room = App.getCurrentRoom()!;
        room.objectById[params.objectId] = params;

        const gameObject = ObjectFactory.createServerSideObject(params);
        await ClientObjectManager.addObject(gameObject);
    },
    // When the client receives a RemoveObjectSignal from the server,
    // the given object will despawn as soon as the room to which it belongs is available.
    onRemoveObjectSignalReceived: async (params: RemoveObjectSignal) => {
        const success = await waitUntilSignalProcessingReady("removeObjectSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == params.roomID);
        if (!success)
            return;

        const room = App.getCurrentRoom()!;

        // If this is a rejection of our speculative spawn, roll back the counter
        if (speculativeAddObjectIds.delete(params.objectId))
            room.lastObjectId--;

        delete room.objectById[params.objectId];

        // If the removed object was selected, unselect it.
        const sel = persistentObjectSelectionObservable.peek();
        if (sel && sel.gameObject.params.objectId === params.objectId)
            PersistentObjectSelection.unselect();

        await ClientObjectManager.removeObject(params.objectId);
    },
    onSetObjectTransformSignalReceived: async (params: SetObjectTransformSignal) => {
        ClientObjectManager.setObjectTransform(params.objectId,
            params.transform.pos, params.transform.dir, !params.ignorePhysics);
    },
    // When the client receives a SetObjectMetadataSignal from the server,
    // the metadata change will be applied to the corresponding game object.
    onSetObjectMetadataSignalReceived: async (params: SetObjectMetadataSignal) => {
        const success = await waitUntilSignalProcessingReady("setObjectMetadataSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == params.roomID);
        if (!success)
            return;

        const room = App.getCurrentRoom()!;
        const obj = room.objectById[params.objectId];
        if (obj)
            obj.setMetadata(params.metadataKey, params.metadataValue);

        const gameObject = ClientObjectManager.getObjectById(params.objectId);
        if (gameObject)
            gameObject.params.setMetadata(params.metadataKey, params.metadataValue);

        // If the modified object was selected by us, deactivate the selection
        // since another user initiated the metadata change (only for metadata types that require it).
        if (ObjectMetadataEntryMap.shouldUnselectObjectOnSet(params.metadataKey))
        {
            const sel = persistentObjectSelectionObservable.peek();
            if (sel && sel.gameObject.params.objectId === params.objectId)
                PersistentObjectSelection.unselect();
        }
    },
}

setObjectMetadataObservable.addListener("clientObjectManager", async (change: {objectId: string, key: ObjectMetadataKey, value: string}) => {
    const gameObject = ClientObjectManager.getObjectById(change.objectId);
    if (gameObject)
        gameObject.onSetMetadata(change.key, change.value);
    else
        console.error(`Object metadata is set, but the object is not found (objectId = ${change.objectId}, key = ${change.key}, value = ${change.value})`);
});

const waitUntilSignalProcessingReady = (signalType: string, successCond: () => boolean): Promise<boolean> =>
    AsyncUtil.waitUntilSuccess(successCond, SignalTypeConfigMap.getConfigByType(signalType).maxClientSideReceptionPeriod)

export default ClientObjectManager;
