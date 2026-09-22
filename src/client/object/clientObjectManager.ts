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
import SetObjectTransformSignal from "../../shared/object/types/setObjectTransformSignal";
import PeriodicTransformReceiver from "./components/periodicTransformReceiver";
import VoxelGameObject from "./types/voxelGameObject";
import { objectSelectionObservable } from "../system/clientObservables";
import ObjectSelection from "../graphics/types/gizmo/objectSelection";
import ObjectUpdateUtil from "../../shared/object/util/objectUpdateUtil";
import Vec3 from "../../shared/math/types/vec3";
import { ObjectMetadataKey } from "../../shared/object/types/objectMetadataKey";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";
import Room from "../../shared/room/types/room";
import VoxelQueryUtil from "../../shared/voxel/util/voxelQueryUtil";
import ClientObjectUtil from "./util/clientObjectUtil";
import RoomLoadProgressUtil from "../system/util/roomLoadProgressUtil";
import VoxelQuadSelection from "../graphics/types/gizmo/voxelQuadSelection";

const gameObjects: {[objectId: string]: GameObject} = {};
const updatableGameObjects: {[objectId: string]: GameObject} = {};
const playerByUserID: {[userID: string]: GameObject} = {};
const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
const voxelTypeIndex = ObjectTypeConfigMap.getIndexByType("Voxel");

// Voxel objects are spawned once (autoUnload=false) and persist for the app's lifetime.
let voxelsSpawned = false;

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
            const gameObject = updatableGameObjects[id];
            gameObject.update(deltaTime);
            const components = gameObject.components;
            for (const name in components)
            {
                if (components[name].update)
                    components[name].update(deltaTime);
            }
        }
    },
    load: async (roomRuntimeMemory: RoomRuntimeMemory) =>
    {
        const room = roomRuntimeMemory.room;

        // Declares the spawn count up front so the loading bar measures real progress.
        RoomLoadProgressUtil.expectUnits(
            (voxelsSpawned ? 0 : room.voxelGrid.voxels.length) +
            Object.keys(room.objectById).length + 1);

        // Voxels persist across rooms: created on the first load, then rebound to each new grid.
        if (!voxelsSpawned)
        {
            await ClientObjectUtil.spawnVoxelsFromGrid(room);
            voxelsSpawned = true;
        }
        else
            resyncVoxelsToCurrentGrid(room);
        let playerPos: Vec3 = {x: 0, y: 0, z: 0};

        // Find the player's initial position for distance-based loading order
        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
        {
            for (const obj of Object.values(room.objectById))
            {
                if (obj.objectTypeIndex === playerTypeIndex)
                {
                    playerPos = obj.transform.pos;
                    break;
                }
            }
        }
        else
            playerPos = ClientObjectUtil.getSingleModePlayerPosition(room);

        // Nearest-first, so canvas images near the player load first.
        const objects = Object.values(room.objectById);
        objects.sort((a, b) =>
        {
            const da = (a.transform.pos.x - playerPos.x) ** 2 + (a.transform.pos.y - playerPos.y) ** 2 + (a.transform.pos.z - playerPos.z) ** 2;
            const db = (b.transform.pos.x - playerPos.x) ** 2 + (b.transform.pos.y - playerPos.y) ** 2 + (b.transform.pos.z - playerPos.z) ** 2;
            return da - db;
        });
        for (const obj of objects)
        {
            if (obj.objectTypeIndex == voxelTypeIndex)
                throw new Error(`Voxel object is not allowed to spawn via objectById.`);
            const gameObject = ObjectFactory.createServerSideObject(obj);
            await ClientObjectManager.addObject(gameObject, false, false); // Don't try to add the object to the room data again because it is already part of it.
        }

        // Single-player rooms spawn the player client-side (the server has no copy). Multiplayer
        // players and doors arrive from the server.
        if (room.roomType == RoomTypeEnumMap.SinglePlayer)
            await ClientObjectUtil.spawnSingleModePlayer(room);
    },
    unload: async () =>
    {
        for (const objectId of Object.keys(gameObjects))
        {
            // autoUnload=false objects (e.g. voxels) are rebound to the next room, not destroyed.
            const config = ObjectTypeConfigMap.getConfigByIndex(gameObjects[objectId].params.objectTypeIndex);
            if (!config.autoUnload)
                continue;
            // Objects whose IDs start with "#" (i.e. client-only objects) are excluded from room data.
            await ClientObjectManager.removeObject(objectId, false, !objectId.startsWith("#"));
        }
    },
    addObject: async (object: GameObject, validate: boolean = true,
        addToRoomData: boolean = true): Promise<boolean> =>
    {
        const user = App.getUser();
        const room = App.getCurrentRoom()!;

        if (!ObjectUpdateUtil.addObject(user, room, object.params, validate, addToRoomData))
            return false;

        if (gameObjects[object.params.objectId] == undefined)
        {
            gameObjects[object.params.objectId] = object;

            if (object.params.objectTypeIndex === playerTypeIndex)
                playerByUserID[object.params.sourceUserID] = object;

            // Updatable if the GameObject itself overrides "update", or any component has an "update".
            let updatable = object.update !== GameObject.prototype.update;
            for (const component of Object.values(object.components))
            {
                if (component.update)
                    updatable = true;
            }
            if (updatable)
                updatableGameObjects[object.params.objectId] = object;
            await object.onSpawn();
            // Counts toward the loading bar during a room load; a no-op otherwise.
            RoomLoadProgressUtil.reportUnitSpawned();
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
        const room = App.getCurrentRoom()!;

        if (!ObjectUpdateUtil.removeObject(user, room, new RemoveObjectSignal(room.id, objectId), validate, removeFromRoomData))
            return false;

        if (gameObjects[objectId] != undefined)
        {
            const object = gameObjects[objectId];
            delete gameObjects[objectId];
            if (updatableGameObjects[object.params.objectId] != undefined)
                delete updatableGameObjects[object.params.objectId];
            if (object.params.objectTypeIndex === playerTypeIndex)
                delete playerByUserID[object.params.sourceUserID];
            await object.onDespawn(); // Asynchronous despawning process must be called AFTER unregistering the object, since the per-frame update call may still unexpectedly access the object while it is being partially torn down.
            return true;
        }
        else
        {
            console.error(`Object (ID = ${objectId}) has already been despawned.`);
            return false;
        }
    },
    setObjectTransform: (objectId: string, transform: ObjectTransform, ignorePhysics: boolean,
        validate: boolean = true): ObjectTransform =>
    {
        const user = App.getUser();
        const room = App.getCurrentRoom()!;

        const signal = new SetObjectTransformSignal(room.id, objectId, transform, ignorePhysics);
        const result = ObjectUpdateUtil.setObjectTransform(user, room, signal, validate);
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
        const room = App.getCurrentRoom()!;

        const signal = new SetObjectMetadataSignal(room.id, objectId, key, value);
        if (!ObjectUpdateUtil.setObjectMetadata(user, room, signal, validate))
            return false;

        const object = ClientObjectManager.getObjectById(objectId);
        if (object)
            object.onSetMetadata(key, value);
        else
            console.error(`ClientObjectManager.setObjectMetadata :: GameObject not found (objectId = ${objectId})`);

        // Re-announce the edited object's selection so its menu and chooser read the new value.
        const selection = objectSelectionObservable.peek();
        if (selection && selection.gameObject.params.objectId === objectId)
            objectSelectionObservable.notify();

        return true;
    },

    // Spawns once the object's room is available.
    onAddObjectSignalReceived: async (signal: AddObjectSignal) => {
        const success = await waitUntilSignalProcessingReady("addObjectSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        const gameObject = ObjectFactory.createServerSideObject(signal);
        await ClientObjectManager.addObject(gameObject, false);
    },
    // Despawns once the object's room is available.
    onRemoveObjectSignalReceived: async (signal: RemoveObjectSignal) => {
        const success = await waitUntilSignalProcessingReady("removeObjectSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        // If the removed object was selected, unselect it.
        const sel = objectSelectionObservable.peek();
        if (sel && sel.gameObject.params.objectId === signal.objectId)
        {
            ObjectSelection.unselect();
            VoxelQuadSelection.trySelectBestQuadNearby(sel.gameObject.params.transform.pos);
        }
        await ClientObjectManager.removeObject(signal.objectId, false);
    },
    onSetObjectTransformSignalReceived: async (signal: SetObjectTransformSignal) => {
        // Deferred handling only for non-physics updates (for performance).
        if (signal.ignorePhysics)
        {
            const success = await waitUntilSignalProcessingReady("setObjectTransformSignal",
                () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
            if (!success)
                return;
        }
        ClientObjectManager.setObjectTransform(signal.objectId, signal.transform,
            signal.ignorePhysics, false);

        // Re-announce a moved selection so its outline and menu follow; skipped for continuous
        // physics updates.
        if (signal.ignorePhysics)
        {
            const sel = objectSelectionObservable.peek();
            if (sel && sel.gameObject.params.objectId === signal.objectId)
                objectSelectionObservable.notify();
        }
    },
    onSetObjectMetadataSignalReceived: async (signal: SetObjectMetadataSignal) => {
        const success = await waitUntilSignalProcessingReady("setObjectMetadataSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        ClientObjectManager.setObjectMetadata(signal.objectId, signal.metadataKey,
            signal.metadataValue, false);
    },
}

// Rebinds persisted voxel objects to the new room's voxels at the same (row, col) and re-stamps each
// voxel's gameObjectId (which quad edits rely on).
const resyncVoxelsToCurrentGrid = (room: Room): void =>
{
    for (const obj of Object.values(gameObjects))
    {
        if (obj.params.objectTypeIndex !== voxelTypeIndex)
            continue;
        const voxelObj = obj as VoxelGameObject;
        const cell = voxelObj.getVoxel();
        const newVoxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, cell.row, cell.col);
        if (!newVoxel)
        {
            console.error(`resyncVoxelsToCurrentGrid :: voxel not found in new room (row = ${cell.row}, col = ${cell.col})`);
            continue;
        }
        voxelObj.setVoxel(newVoxel);
        voxelObj.refreshAllQuads();
    }
}

const waitUntilSignalProcessingReady = (signalType: string, successCond: () => boolean): Promise<boolean> =>
    AsyncUtil.waitUntilSuccess(successCond, SignalTypeConfigMap.getConfigByType(signalType).maxClientSideReceptionPeriod)

export default ClientObjectManager;
