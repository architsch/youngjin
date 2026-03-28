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
import VoxelGameObject from "./types/voxelGameObject";
import { objectSelectionObservable } from "../system/clientObservables";
import ObjectSelection from "../graphics/types/gizmo/objectSelection";
import ObjectUpdateUtil from "../../shared/object/util/objectUpdateUtil";
import Vec3 from "../../shared/math/types/vec3";
import { ObjectMetadataKey } from "../../shared/object/types/objectMetadataKey";

const gameObjects: {[objectId: string]: GameObject} = {};
const updatableGameObjects: {[objectId: string]: GameObject} = {};
const playerByUserID: {[userID: string]: GameObject} = {};
const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
const voxelTypeIndex = ObjectTypeConfigMap.getIndexByType("Voxel");

const ClientObjectManager =
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
            await ClientObjectManager.addObject(gameObject, false, false); // Don't try to add the object to the room data because voxels don't reside in its object dictionary.
        }

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
            await ClientObjectManager.addObject(gameObject, false, false); // Don't try to add the object to the room data again because it is already part of it.
        }
    },
    unload: async () =>
    {
        for (const objectId of Object.keys(gameObjects))
        {
            // Objects whose IDs start with "#" (i.e. client-only objects) are excluded from room data.
            await ClientObjectManager.removeObject(objectId, false, !objectId.startsWith("#"));
        }
    },
    addObject: async (object: GameObject, validate: boolean = true,
        addToRoomData: boolean = true): Promise<boolean> =>
    {
        const user = App.getUser();
        const userRole = App.getCurrentUserRole();
        const room = App.getCurrentRoom()!;

        if (addToRoomData)
        {
            if (!ObjectUpdateUtil.addObject(user, userRole, room, object.params, validate))
                return false;
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
            return true;
        }
        else
        {
            console.error(`Object (ID = ${object.params.objectId}) has already been spawned.`);
            return false;
        }
    },
    removeObject: async (objectId: string, validate: boolean = true,
        removeFromRoomData: boolean = true): Promise<boolean> =>
    {
        const user = App.getUser();
        const userRole = App.getCurrentUserRole();
        const room = App.getCurrentRoom()!;

        if (removeFromRoomData)
        {
            if (!ObjectUpdateUtil.removeObject(user, userRole, room, new RemoveObjectSignal(room.id, objectId), validate))
                return false;
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
            return true;
        }
        else
        {
            console.error(`Object (ID = ${objectId}) has already been despawned.`);
            return false;
        }
    },
    setObjectTransform: (objectId: string, pos: Vec3, dir: Vec3, ignorePhysics: boolean,
        validate: boolean = true): ObjectTransform =>
    {
        const user = App.getUser();
        const userRole = App.getCurrentUserRole();
        const room = App.getCurrentRoom()!;

        const signal = new SetObjectTransformSignal(room.id, objectId, new ObjectTransform(pos, dir), ignorePhysics);
        const result = ObjectUpdateUtil.setObjectTransform(user, userRole, room, signal, validate);
        const object = ClientObjectManager.getObjectById(objectId);
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
    setObjectMetadata: (objectId: string, key: ObjectMetadataKey, value: string,
        validate: boolean = true): boolean =>
    {
        const user = App.getUser();
        const userRole = App.getCurrentUserRole();
        const room = App.getCurrentRoom()!;

        const signal = new SetObjectMetadataSignal(room.id, objectId, key, value);
        if (!ObjectUpdateUtil.setObjectMetadata(user, userRole, room, signal, validate))
            return false;

        if (ObjectMetadataEntryMap.shouldUnselectObjectOnSet(key))
        {
            const sel = objectSelectionObservable.peek();
            if (sel && sel.gameObject.params.objectId === objectId)
                ObjectSelection.unselect();
        }

        const object = ClientObjectManager.getObjectById(objectId);
        if (object)
            object.onSetMetadata(key, value);
        else
            console.error(`ClientObjectManager.setObjectMetadata :: GameObject not found (objectId = ${objectId})`);

        return true;
    },

    // When the client receives an AddObjectSignal from the server,
    // the given object will spawn as soon as the room to which it belongs is available.
    onAddObjectSignalReceived: async (signal: AddObjectSignal) => {
        const success = await waitUntilSignalProcessingReady("addObjectSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        const gameObject = ObjectFactory.createServerSideObject(signal);
        await ClientObjectManager.addObject(gameObject, false);
    },
    // When the client receives a RemoveObjectSignal from the server,
    // the given object will despawn as soon as the room to which it belongs is available.
    onRemoveObjectSignalReceived: async (signal: RemoveObjectSignal) => {
        const success = await waitUntilSignalProcessingReady("removeObjectSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        // If the removed object was selected, unselect it.
        const sel = objectSelectionObservable.peek();
        if (sel && sel.gameObject.params.objectId === signal.objectId)
            ObjectSelection.unselect();
        await ClientObjectManager.removeObject(signal.objectId, false);
    },
    onSetObjectTransformSignalReceived: async (signal: SetObjectTransformSignal) => {
        // Apply graceful (conditionally deferred) signal handling only if
        // the signal is NOT a result of real-time physics calculation (for performance reasons).
        if (signal.ignorePhysics)
        {
            const success = await waitUntilSignalProcessingReady("setObjectTransformSignal",
                () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
            if (!success)
                return;
        }
        ClientObjectManager.setObjectTransform(signal.objectId,
            signal.transform.pos, signal.transform.dir, signal.ignorePhysics, false);
    },
    // When the client receives a SetObjectMetadataSignal from the server,
    // the metadata change will be applied to the corresponding game object.
    onSetObjectMetadataSignalReceived: async (signal: SetObjectMetadataSignal) => {
        const success = await waitUntilSignalProcessingReady("setObjectMetadataSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        ClientObjectManager.setObjectMetadata(signal.objectId, signal.metadataKey,
            signal.metadataValue, false);
    },
}

const waitUntilSignalProcessingReady = (signalType: string, successCond: () => boolean): Promise<boolean> =>
    AsyncUtil.waitUntilSuccess(successCond, SignalTypeConfigMap.getConfigByType(signalType).maxClientSideReceptionPeriod)

export default ClientObjectManager;
