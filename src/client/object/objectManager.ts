import GameObject from "../object/types/gameObject";
import Updatable from "../object/interfaces/updatable";
import GameSocketsClient from "../networking/gameSocketsClient";
import ObjectSyncParams from "../../shared/object/objectSyncParams";
import ObjectSpawnParams from "../../shared/object/objectSpawnParams";
import ObjectDespawnParams from "../../shared/object/objectDespawnParams";
import NetworkObject from "../object/types/networkObject";
import ObjectFactory from "../object/objectFactory";
import Player from "../object/types/player";
import ObjectMessageParams from "../../shared/object/objectMessageParams";
import Voxel from "../voxel/voxel";
import App from "../app";
import VoxelManager from "../voxel/voxelManager";
import VoxelObject from "./types/voxelObject";
import RoomServerRecord from "../../shared/room/roomServerRecord";
import ObjectDesyncResolveParams from "../../shared/object/objectDesyncResolveParams";

const gameObjects: {[objectId: string]: GameObject} = {};
const updatableGameObjects: {[objectId: string]: Updatable} = {};
const players: {[userName: string]: Player} = {};

const ObjectManager =
{
    getObjectById: (objectId: string): GameObject | undefined =>
    {
        return gameObjects[objectId];
    },
    getPlayer: (): Player | undefined =>
    {
        return players[App.getEnv().user.userName];
    },
    update: (deltaTime: number) =>
    {
        for (const updatableGameObject of Object.values(updatableGameObjects))
            updatableGameObject.update(deltaTime);
    },
    load: async (roomServerRecord: RoomServerRecord) =>
    {
        VoxelManager.forEachVoxelAsync(async (voxel: Voxel) => {
            const gameObject = ObjectFactory.createNewObject(voxel.voxelType,
                { // transform
                    x: voxel.col, y: 0, z: voxel.row,
                    eulerX: 0, eulerY: 0, eulerZ: 0,
                }, { // metadata
                    geometryId: voxel.voxelType as string,
                    materialId: `Phong-${voxel.textureId}`,
                    numInstances: 1024,
                    uvStart: voxel.uvStart,
                }
            );
            await ObjectManager.spawnObject(gameObject);
            voxel.object = gameObject as VoxelObject;
            voxel.object.setVoxel(voxel);
        });
        
        await ObjectManager.spawnObject(ObjectFactory.createNewObject("Player", {
            x: 15 + 2*Math.random(), y: 0, z: 15 + 2*Math.random(),
            eulerX: 0, eulerY: Math.random() * Math.PI*2, eulerZ: 0,
        }));

        // Load objects from objectServerRecords
        for (const objectServerRecord of Object.values(roomServerRecord.objectServerRecords))
        {
            const object = ObjectFactory.createObjectFromNetwork(objectServerRecord.objectSpawnParams);
            await ObjectManager.spawnObject(object);
        }

        // Add listeners
        GameSocketsClient.objectSyncObservable.addListener("room", (params: ObjectSyncParams) => {
            const gameObject = gameObjects[params.objectId];
            if ("onObjectSync" in gameObject)
                (gameObject as NetworkObject).onObjectSync(params);
            else
                throw new Error(`GameObject is not a NetworkObject (${JSON.stringify(params)})`);
        });
        GameSocketsClient.objectDesyncResolveObservable.addListener("room", (params: ObjectDesyncResolveParams) => {
            const gameObject = gameObjects[params.objectId];
            if ("onObjectDesyncResolve" in gameObject)
                (gameObject as NetworkObject).onObjectDesyncResolve(params);
            else
                throw new Error(`GameObject is not a NetworkObject (${JSON.stringify(params)})`);
        });
        GameSocketsClient.objectSpawnObservable.addListener("room", async (params: ObjectSpawnParams) => {
            if (gameObjects[params.objectId] != undefined)
                return;
            const gameObject = ObjectFactory.createObjectFromNetwork(params);
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
            if ("onObjectMessageReceived" in gameObject)
            {
                (gameObject as any).onObjectMessageReceived(params);
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
            if ("update" in object)
                updatableGameObjects[object.params.objectId] = object as Updatable;
            if (object.params.objectType == "Player")
                players[object.params.sourceUserName] = object as Player;
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