import * as THREE from "three";
import ObjectSyncParams from "../../../shared/types/object/objectSyncParams";
import GameSocketsClient from "../../networking/gameSocketsClient";
import GameObject from "../../object/types/gameObject";

const syncIntervalInMillis = 200;
const minSyncDistSqr = 0.0001;
const minSyncAngle = 0.01;

export default class ObjectSyncEmitter
{
    private gameObject: GameObject;
    private lastSyncTime: number;
    private lastSyncedPosition: THREE.Vector3 = new THREE.Vector3();
    private lastSyncedRotation: THREE.Euler = new THREE.Euler();

    constructor(gameObject: GameObject)
    {
        this.gameObject = gameObject;
        this.lastSyncTime = performance.now();
        this.lastSyncedPosition.copy(gameObject.position);
        this.lastSyncedRotation.copy(gameObject.rotation);
    }

    update(): void
    {
        const currTime = performance.now();
        if (currTime - this.lastSyncTime > syncIntervalInMillis)
        {
            this.lastSyncTime = currTime;
            if (Math.abs(this.gameObject.position.distanceToSquared(this.lastSyncedPosition)) > minSyncDistSqr ||
                Math.abs(this.gameObject.rotation.x - this.lastSyncedRotation.x) > minSyncAngle ||
                Math.abs(this.gameObject.rotation.y - this.lastSyncedRotation.y) > minSyncAngle ||
                Math.abs(this.gameObject.rotation.z - this.lastSyncedRotation.z) > minSyncAngle)
            {
                this.lastSyncedPosition.copy(this.gameObject.position);
                this.lastSyncedRotation.copy(this.gameObject.rotation);

                const params: ObjectSyncParams = {
                    objectId: this.gameObject.params.objectId,
                    transform: {
                        x: Math.floor(this.lastSyncedPosition.x * 100) * 0.01,
                        y: Math.floor(this.lastSyncedPosition.y * 100) * 0.01,
                        z: Math.floor(this.lastSyncedPosition.z * 100) * 0.01,
                        eulerX: Math.floor(this.lastSyncedRotation.x * 100) * 0.01,
                        eulerY: Math.floor(this.lastSyncedRotation.y * 100) * 0.01,
                        eulerZ: Math.floor(this.lastSyncedRotation.z * 100) * 0.01,
                    }
                };
                GameSocketsClient.emitObjectSync(params);
                //console.log(`(ObjectSyncEmitter) emitObjectSync :: ${JSON.stringify(params)}`);
            }
        }
    }
}