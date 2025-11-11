import GameObject from "../object/types/gameObject";
import GameSocketsClient from "../networking/gameSocketsClient";
import ObjectSyncParams from "../../shared/object/types/objectSyncParams";
import ObjectSpawnParams from "../../shared/object/types/objectSpawnParams";
import ObjectDespawnParams from "../../shared/object/types/objectDespawnParams";
import ObjectFactory from "./factories/objectFactory";
import ObjectMessageParams from "../../shared/object/types/objectMessageParams";
import App from "../app";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import ObjectDesyncResolveParams from "../../shared/object/types/objectDesyncResolveParams";
import ObjectTypeConfigMap from "../../shared/object/maps/objectTypeConfigMap";
import VoxelObject from "./components/voxelObject";
import ObjectTransform from "../../shared/object/types/objectTransform";

const gameObjects: {[objectId: string]: GameObject} = {};
const updatableGameObjects: {[objectId: string]: GameObject} = {};
const players: {[userName: string]: GameObject} = {};

const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");

const ObjectManager =
{
    getObjectById: (objectId: string): GameObject | undefined =>
    {
        return gameObjects[objectId];
    },
    getMyPlayer: (): GameObject | undefined =>
    {
        const env = App.getEnv();
        if (env && env.user)
            return players[App.getEnv().user.userName];
        console.error(`Failed to fetch the user data (env = ${JSON.stringify(env)})`);
        return undefined;
    },
    update: (deltaTime: number) =>
    {
        for (const updatableGameObject of Object.values(updatableGameObjects))
        {
            for (const component of Object.values(updatableGameObject.components))
            {
                if (component.update)
                    component.update(deltaTime);
            }
        }
    },
    load: async (roomRuntimeMemory: RoomRuntimeMemory) =>
    {
        const voxelTypeIndex = ObjectTypeConfigMap.getIndexByType("Voxel");
        for (const voxel of roomRuntimeMemory.room.voxelGrid.voxels)
        {
            const gameObject = ObjectFactory.createClientSideObject(
                voxelTypeIndex,
                new ObjectTransform(
                    voxel.col + 0.5, 0, voxel.row + 0.5,
                    0, 0, 1
                )
            );
            const voxelObject = gameObject.components.voxelObject! as VoxelObject;
            voxelObject.setVoxel(voxel);
            await ObjectManager.spawnObject(gameObject);
        };

        // Load objects from decodedPersistentObjects
        for (const po of roomRuntimeMemory.room.persistentObjects)
        {
            // Let's assume that (+z) is the direction in which the 0 y-axis angle is pointing.
            let dirX = 0, dirY = 0, dirZ = 0;
            switch (po.direction)
            {
                case "+z": dirX = 0; dirY = 0; dirZ = 1; break;
                case "-z": dirX = 0; dirY = 0; dirZ = -1; break;
                case "+x": dirX = 1; dirY = 0; dirZ = 0; break;
                case "-x": dirX = -1; dirY = 0; dirZ = 0; break;
                default: throw new Error(`Unknown direction (${po.direction})`);
            }
            const objectSpawnParams = new ObjectSpawnParams(
                "", // Persistent objects are not directly owned by anyone.
                po.objectTypeIndex,
                po.objectId,
                new ObjectTransform(po.x, po.y, po.z, dirX, dirY, dirZ),
                po.metadata
            );
            if (objectSpawnParams.objectTypeIndex == voxelTypeIndex)
                throw new Error(`Voxel object is not allowed to spawn via persistentObjects.`);
            const object = ObjectFactory.createServerSideObject(objectSpawnParams);
            await ObjectManager.spawnObject(object);
        }

        // Load objects from objectRuntimeMemories
        for (const objectRuntimeMemory of Object.values(roomRuntimeMemory.objectRuntimeMemories))
        {
            if (objectRuntimeMemory.objectSpawnParams.objectTypeIndex == voxelTypeIndex)
                throw new Error(`Voxel object is not allowed to spawn via objectRuntimeMemories.`);
            const object = ObjectFactory.createServerSideObject(objectRuntimeMemory.objectSpawnParams);
            await ObjectManager.spawnObject(object);
        }

        // Add listeners
        GameSocketsClient.objectSyncObservable.addListener("room", (params: ObjectSyncParams) => {
            const gameObject = gameObjects[params.objectId];
            if (gameObject == undefined)
            {
                console.error(`Object to be synced not found (params.objectId = ${params.objectId})`);
                return;
            }
            for (const component of Object.values(gameObject.components))
            {
                if (component.onObjectSyncReceived)
                    component.onObjectSyncReceived(params);
            }
        });
        GameSocketsClient.objectDesyncResolveObservable.addListener("room", (params: ObjectDesyncResolveParams) => {
            const gameObject = gameObjects[params.objectId];
            for (const component of Object.values(gameObject.components))
            {
                if (component.onObjectDesyncResolveReceived)
                    component.onObjectDesyncResolveReceived(params);
            }
        });
        GameSocketsClient.objectSpawnObservable.addListener("room", async (params: ObjectSpawnParams) => {
            if (gameObjects[params.objectId] != undefined)
                return;
            const gameObject = ObjectFactory.createServerSideObject(params);
            await ObjectManager.spawnObject(gameObject);
        });
        GameSocketsClient.objectDespawnObservable.addListener("room", async (params: ObjectDespawnParams) => {
            await ObjectManager.despawnObject(params.objectId);
        });
        GameSocketsClient.objectMessageObservable.addListener("room", (params: ObjectMessageParams) => {
            const gameObject = gameObjects[params.senderObjectId];
            if (gameObject == undefined)
            {
                console.error(`Message sender object not found (params.senderObjectId = ${params.senderObjectId})`);
                return;
            }
            for (const component of Object.values(gameObject.components))
            {
                if (component.onObjectMessageReceived)
                    component.onObjectMessageReceived(params);
            }
        });
    },
    unload: async () =>
    {
        // Unload objects
        const stringsTemp: string[] = [];
        for (const key of Object.keys(gameObjects))
            stringsTemp.push(key);
        for (const key of stringsTemp)
        {
            await ObjectManager.despawnObject(key);
            delete gameObjects[key];
        }

        stringsTemp.length = 0;
        for (const key of Object.keys(updatableGameObjects))
            stringsTemp.push(key);
        for (const key of stringsTemp)
            delete updatableGameObjects[key];

        stringsTemp.length = 0;
        for (const key of Object.keys(players))
            stringsTemp.push(key);
        for (const key of stringsTemp)
            delete players[key];

        // Remove listeners
        GameSocketsClient.objectSyncObservable.removeListener("room");
        GameSocketsClient.objectSpawnObservable.removeListener("room");
        GameSocketsClient.objectDespawnObservable.removeListener("room");
        GameSocketsClient.objectMessageObservable.removeListener("room");
    },
    spawnObject: async (object: GameObject) =>
    {
        if (gameObjects[object.params.objectId] == undefined)
        {
            gameObjects[object.params.objectId] = object;

            let updatable = false;
            for (const component of Object.values(object.components))
            {
                if (component.update)
                    updatable = true;
            }
            if (updatable)
                updatableGameObjects[object.params.objectId] = object;
            if (object.params.objectTypeIndex == playerTypeIndex) 
                players[object.params.sourceUserName] = object;
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
            if (players[object.params.sourceUserName] != undefined)
                delete players[object.params.sourceUserName];
        }
        else
        {
            console.error(`Object (ID = ${objectId}) has already been despawned.`);
        }
    },
}

export default ObjectManager;