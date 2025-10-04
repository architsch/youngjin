import * as THREE from "three";
import GraphicsContext from "../graphics/graphicsContext";
import GameObject from "./object/types/gameObject";
import Updatable from "./interface/updatable";
import GameSocketsClient from "../networking/gameSocketsClient";
import ObjectSyncParams from "../../shared/types/gameplay/objectSyncParams";
import ObjectSpawnParams from "../../shared/types/gameplay/objectSpawnParams";
import ObjectDespawnParams from "../../shared/types/gameplay/objectDespawnParams";
import NetworkObject from "./object/types/networkObject";
import ObjectFactory from "./object/objectFactory";
import WorldSyncParams from "../../shared/types/gameplay/worldSyncParams";
import Player from "./object/types/player";
import ObjectMessageParams from "../../shared/types/gameplay/objectMessageParams";

export default class World
{
    static currentInstance: World;

    userName: string;
    graphicsContext: GraphicsContext;

    private gameObjects: {[objectId: string]: GameObject};
    private updatableGameObjects: {[objectId: string]: Updatable};
    private players: {[userName: string]: Player};
    private prevTime;

    constructor(params: WorldSyncParams)
    {
        World.currentInstance = this;

        this.userName = JSON.parse((window as any).thingspool_env.userString).userName as string;
        this.graphicsContext = new GraphicsContext();
        this.gameObjects = {};
        this.updatableGameObjects = {};
        this.players = {};
        this.prevTime = performance.now();

        this.update = this.update.bind(this);
        this.graphicsContext.gameRenderer.setAnimationLoop(this.update);

        GameSocketsClient.addObjectSyncListener((params: ObjectSyncParams) => {
            const gameObject = this.gameObjects[params.objectId];
            if ("onObjectSync" in gameObject)
                (gameObject as NetworkObject).onObjectSync(params);
            else
                throw new Error(`GameObject is not a NetworkObject (${JSON.stringify(params)})`);
        });
        GameSocketsClient.addObjectSpawnListener((params: ObjectSpawnParams) => {
            if (this.gameObjects[params.objectId] != undefined)
                return;
            const gameObject = ObjectFactory.createObjectFromNetwork(this, params);
            this.spawnObject(gameObject);
        });
        GameSocketsClient.addObjectDespawnListener((params: ObjectDespawnParams) => {
            this.despawnObject(params.objectId);
        });
        GameSocketsClient.addObjectMessageListener((params: ObjectMessageParams) => {
            const gameObject = this.gameObjects[params.senderObjectId];
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

        for (let z = -5; z <= 5; ++z)
        {
            for (let x = -5; x <= 5; ++x)
            {
                this.spawnObject(ObjectFactory.createFloor(this, { x: x, y: 0, z: z, eulerX: 0, eulerY: 0, eulerZ: 0 }));
                if (z == -5 || z == 5 || x == -5 || x == 5)
                    this.spawnObject(ObjectFactory.createWall(this, { x: x, y: 0, z: z, eulerX: 0, eulerY: 0, eulerZ: 0 }));
            }
        }
        this.spawnObject(ObjectFactory.createPlayer(this, {
            x: 4*Math.random() - 2, y: 0, z: 4*Math.random() - 2,
            eulerX: 0, eulerY: Math.random() * Math.PI*2, eulerZ: 0,
        }));

        for (const objectRecord of Object.values(params.objectRecords))
        {
            const object = ObjectFactory.createObjectFromNetwork(this, objectRecord.objectSpawnParams);
            this.spawnObject(object);
        }
    }

    get gameCanvas(): HTMLCanvasElement
    {
        return this.graphicsContext.gameRenderer.domElement;
    }
    get camera(): THREE.PerspectiveCamera
    {
        return this.graphicsContext.camera;
    }

    getPlayer(userName: string): Player | undefined
    {
        return this.players[userName];
    }

    spawnObject(object: GameObject)
    {
        if (this.gameObjects[object.objectId] == undefined)
        {
            this.gameObjects[object.objectId] = object;
            if ("update" in object)
                this.updatableGameObjects[object.objectId] = object as Updatable;
            if (object.getObjectType() == "Player")
                this.players[object.sourceUserName] = object as Player;
            object.onSpawn();
        }
        else
        {
            console.error(`Object (ID = ${object.objectId}) has already been spawned.`);
        }
    }

    despawnObject(objectId: string)
    {
        if (this.gameObjects[objectId] != undefined)
        {
            const object = this.gameObjects[objectId];
            object.onDespawn();
            delete this.gameObjects[objectId];
            if (this.updatableGameObjects[object.objectId] != undefined)
                delete this.updatableGameObjects[object.objectId];
            if (this.players[object.sourceUserName] != undefined)
                delete this.players[object.sourceUserName];
        }
        else
        {
            console.error(`Object (ID = ${objectId}) has already been despawned.`);
        }
    }

    private update(): void
    {
        const currTime = performance.now();
        const deltaTime = Math.min(0.1, currTime - this.prevTime);
        this.prevTime = currTime;

        for (const updatableGameObject of Object.values(this.updatableGameObjects))
            updatableGameObject.update(deltaTime);

        this.graphicsContext.update();
    }
}