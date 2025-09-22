import GraphicsContext from "../graphics/graphicsContext";
import GameObject from "./objects/gameObject";
import Wall from "./objects/wall";
import Floor from "./objects/floor";
import MyPlayer from "./objects/myPlayer";
import OtherPlayer from "./objects/otherPlayer";
import Updatable from "./interfaces/updatable";

export default class World
{
    private graphicsContext: GraphicsContext;
    private gameObjects: {[id: number]: GameObject};
    private updatableGameObjects: {[id: number]: Updatable};
    private lastGameObjectId;
    private prevTime;

    constructor(graphicsContext: GraphicsContext)
    {
        this.graphicsContext = graphicsContext;
        this.gameObjects = {};
        this.updatableGameObjects = {};
        this.lastGameObjectId = 0;
        this.prevTime = performance.now();

        this.createMyPlayer(0, 0);

        for (let z = -5; z <= 5; ++z)
        {
            for (let x = -5; x <= 5; ++x)
            {
                this.createFloor(x, z);
                if (z == -5 || z == 5 || x == -5 || x == 5)
                    this.createWall(x, z);
            }
        }

        this.createOtherPlayer(3, 3);
        this.createOtherPlayer(-3, -4);
        this.createOtherPlayer(-2, 4);
        this.createOtherPlayer(-4, -1);
        this.createOtherPlayer(-3.5, -2);
        this.createOtherPlayer(4, 2);
        this.createOtherPlayer(2, -3.5);

        //graphicsContext.renderer.domElement.addEventListener("resize", (ev: UIEvent) => {
        //    graphicsContext.renderer.setSize(graphicsContext.renderer.domElement.clientWidth, graphicsContext.renderer.domElement.clientHeight);
        //});
        this.update = this.update.bind(this);
        graphicsContext.renderer.setAnimationLoop(this.update);
    }

    createMyPlayer(x: number, z: number): void
    {
        this.addGameObject(new MyPlayer(this.graphicsContext, x, z));
    }

    createOtherPlayer(x: number, z: number): void
    {
        this.addGameObject(new OtherPlayer(this.graphicsContext, x, z));
    }

    createWall(x: number, z: number): void
    {
        this.addGameObject(new Wall(this.graphicsContext, x, z));
    }

    createFloor(x: number, z: number): void
    {
        this.addGameObject(new Floor(this.graphicsContext, x, z));
    }

    private addGameObject(gameObject: GameObject): void
    {
        gameObject.id = ++this.lastGameObjectId;
        this.gameObjects[gameObject.id] = gameObject;
        if ("update" in gameObject)
            this.updatableGameObjects[gameObject.id] = gameObject as Updatable;
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