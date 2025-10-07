import GameObject from "../object/types/gameObject";
import Updatable from "../object/interfaces/updatable";
import GameSocketsClient from "../networking/gameSocketsClient";
import ObjectSyncParams from "../../shared/types/object/objectSyncParams";
import ObjectSpawnParams from "../../shared/types/object/objectSpawnParams";
import ObjectDespawnParams from "../../shared/types/object/objectDespawnParams";
import NetworkObject from "../object/types/networkObject";
import ObjectFactory from "../object/objectFactory";
import Player from "../object/types/player";
import ObjectMessageParams from "../../shared/types/object/objectMessageParams";
import Voxel from "../voxel/voxel";
import ObjectRecord from "../../shared/types/object/objectRecord";
import App from "../app";

const gameObjects: {[objectId: string]: GameObject} = {};
const updatableGameObjects: {[objectId: string]: Updatable} = {};
const players: {[userName: string]: Player} = {};

const ObjectManager =
{
    getPlayer: (): Player | undefined =>
    {
        return players[App.getEnv().user.userName];
    },
    update: (deltaTime: number) =>
    {
        for (const updatableGameObject of Object.values(updatableGameObjects))
            updatableGameObject.update(deltaTime);
    },
    load: async (voxelGrid: Voxel[], objectRecords: {[objectId: string]: ObjectRecord}) =>
    {
        // Load objects from voxelGrid
        for (let i = 0; i < voxelGrid.length; ++i)
        {
            const voxel = voxelGrid[i];
            ObjectManager.spawnObject(ObjectFactory.createNewObject(voxel.voxelType,
            { // transform
                x: voxel.col, y: 0, z: voxel.row,
                eulerX: 0, eulerY: 0, eulerZ: 0,
            }, { // metadata
                textureId: voxel.textureId,
            }));
        }
        ObjectManager.spawnObject(ObjectFactory.createNewObject("Player", {
            x: 15 + 2*Math.random(), y: 0, z: 15 + 2*Math.random(),
            eulerX: 0, eulerY: Math.random() * Math.PI*2, eulerZ: 0,
        }));

        // Load objects from objectRecords
        for (const objectRecord of Object.values(objectRecords))
        {
            const object = ObjectFactory.createObjectFromNetwork(objectRecord.objectSpawnParams);
            ObjectManager.spawnObject(object);
        }

        // Add listeners
        GameSocketsClient.objectSyncObservable.addListener("room", (params: ObjectSyncParams) => {
            const gameObject = gameObjects[params.objectId];
            if ("onObjectSync" in gameObject)
                (gameObject as NetworkObject).onObjectSync(params);
            else
                throw new Error(`GameObject is not a NetworkObject (${JSON.stringify(params)})`);
        });
        GameSocketsClient.objectSpawnObservable.addListener("room", (params: ObjectSpawnParams) => {
            if (gameObjects[params.objectId] != undefined)
                return;
            const gameObject = ObjectFactory.createObjectFromNetwork(params);
            ObjectManager.spawnObject(gameObject);
        });
        GameSocketsClient.objectDespawnObservable.addListener("room", (params: ObjectDespawnParams) => {
            ObjectManager.despawnObject(params.objectId);
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
    unload: () =>
    {
        // Unload objects
        const stringsTemp: string[] = [];
        for (const key of Object.keys(gameObjects))
            stringsTemp.push(key);
        for (const key of stringsTemp)
        {
            ObjectManager.despawnObject(key);
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
    spawnObject: (object: GameObject) =>
    {
        if (gameObjects[object.params.objectId] == undefined)
        {
            gameObjects[object.params.objectId] = object;
            if ("update" in object)
                updatableGameObjects[object.params.objectId] = object as Updatable;
            if (object.params.objectType == "Player")
                players[object.params.sourceUserName] = object as Player;
            object.onSpawn();
        }
        else
        {
            console.error(`Object (ID = ${object.params.objectId}) has already been spawned.`);
        }
    },
    despawnObject: (objectId: string) =>
    {
        if (gameObjects[objectId] != undefined)
        {
            const object = gameObjects[objectId];
            object.onDespawn();
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