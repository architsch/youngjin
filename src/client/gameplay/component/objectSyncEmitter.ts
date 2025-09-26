import ObjectSyncParams from "../../../shared/types/networking/objectSyncParams";
import GameSocketsClient from "../../networking/gameSocketsClient";
import GameObject from "../object/types/gameObject";

const syncIntervalInMillis = 250;
const minSyncOffset = 0.01;
const minSyncAngle = 0.01;

export default class ObjectSyncEmitter
{
    private gameObject: GameObject;
    private lastSyncTime: number;
    private lastSyncedX: number;
    private lastSyncedZ: number;
    private lastSyncedAngleY: number;

    constructor(gameObject: GameObject)
    {
        this.gameObject = gameObject;
        this.lastSyncTime = performance.now();
        this.lastSyncedX = gameObject.position.x;
        this.lastSyncedZ = gameObject.position.z;
        this.lastSyncedAngleY = gameObject.rotation.y;
    }

    update(): void
    {
        const currTime = performance.now();
        if (currTime - this.lastSyncTime > syncIntervalInMillis)
        {
            this.lastSyncTime = currTime;
            if (Math.abs(this.lastSyncedX - this.gameObject.position.x) > minSyncOffset ||
                Math.abs(this.lastSyncedZ - this.gameObject.position.z) > minSyncOffset ||
                Math.abs(this.lastSyncedAngleY - this.gameObject.rotation.y) > minSyncAngle)
            {
                this.lastSyncedX = this.gameObject.position.x;
                this.lastSyncedZ = this.gameObject.position.z;
                this.lastSyncedAngleY = this.gameObject.rotation.y;

                const params: ObjectSyncParams = {
                    objectId: this.gameObject.objectId,
                    x: this.lastSyncedX,
                    z: this.lastSyncedZ,
                    angleY: this.lastSyncedAngleY,
                };
                GameSocketsClient.emitObjectSync(params);
                //console.log(`(ObjectSyncEmitter) emitObjectSync :: ${JSON.stringify(params)}`);
            }
        }
    }
}