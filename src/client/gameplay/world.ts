import GraphicsContext from "../graphics/graphicsContext";
import GameObject from "./object/types/gameObject";
import Updatable from "./interface/updatable";
import GameSocketsClient from "../networking/gameSocketsClient";
import ObjectSyncParams from "../../shared/types/networking/objectSyncParams";
import ObjectSpawnParams from "../../shared/types/networking/objectSpawnParams";
import ObjectDespawnParams from "../../shared/types/networking/objectDespawnParams";
import NetworkObject from "./object/types/networkObject";
import ObjectFactory from "./object/objectFactory";
import WorldSyncParams from "../../shared/types/networking/worldSyncParams";

export default class World
{
    userName: string;
    graphicsContext: GraphicsContext;

    private gameObjects: {[objectId: string]: GameObject};
    private updatableGameObjects: {[objectId: string]: Updatable};
    private prevTime;

    constructor(params: WorldSyncParams)
    {
        this.userName = JSON.parse((window as any).thingspool_user).userName as string;
        this.graphicsContext = new GraphicsContext();
        this.gameObjects = {};
        this.updatableGameObjects = {};
        this.prevTime = performance.now();

        //graphicsContext.renderer.domElement.addEventListener("resize", (ev: UIEvent) => {
        //    graphicsContext.renderer.setSize(graphicsContext.renderer.domElement.clientWidth, graphicsContext.renderer.domElement.clientHeight);
        //});
        this.update = this.update.bind(this);
        this.graphicsContext.renderer.setAnimationLoop(this.update);

        GameSocketsClient.addObjectSyncListener((params: ObjectSyncParams) => {
            const gameObject = this.gameObjects[params.objectId];
            if ("onObjectSync" in gameObject)
                (gameObject as NetworkObject).onObjectSync(params);
            else
                throw new Error(`GameObject is not a NetworkObject (${JSON.stringify(params)})`);
        });
        GameSocketsClient.addObjectSpawnListener((params: ObjectSpawnParams) => {
            const object = ObjectFactory.createObjectFromNetwork(this, params);
            this.spawnObject(object);
        });
        GameSocketsClient.addObjectDespawnListener((params: ObjectDespawnParams) => {
            this.despawnObject(params.objectId);
        });

        for (let z = -5; z <= 5; ++z)
        {
            for (let x = -5; x <= 5; ++x)
            {
                this.spawnObject(ObjectFactory.createFloor(this, x, z, 0));
                if (z == -5 || z == 5 || x == -5 || x == 5)
                    this.spawnObject(ObjectFactory.createWall(this, x, z, 0));
            }
        }
        this.spawnObject(ObjectFactory.createPlayer(this, 0, 0, 0));

        for (const objectRecord of Object.values(params.objectRecords))
        {
            const objectSpawnParams: ObjectSpawnParams = {
                objectType: objectRecord.objectType,
                objectId: objectRecord.objectId,
                x: objectRecord.x,
                z: objectRecord.z,
                angleY: objectRecord.angleY,
            };
            const object = ObjectFactory.createObjectFromNetwork(this, objectSpawnParams);
            this.spawnObject(object);
        }
    }

    spawnObject(object: GameObject)
    {
        if (this.gameObjects[object.objectId] == undefined)
        {
            this.gameObjects[object.objectId] = object;
            if ("update" in object)
                this.updatableGameObjects[object.objectId] = object as Updatable;
            object.onSpawn();
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
        }
    }

    private update(): void
    {
        const currTime = performance.now();
        const deltaTime = Math.min(0.1, currTime - this.prevTime);
        this.prevTime = currTime;

        for (const updatableGameObject of Object.values(this.updatableGameObjects))
            updatableGameObject.update(deltaTime);

        this.graphicsContext.renderer.render(this.graphicsContext.scene, this.graphicsContext.camera);
    }
}