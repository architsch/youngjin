import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import GameObject from "../types/gameObject";
import { SIGNAL_BATCH_SEND_INTERVAL } from "../../../shared/system/sharedConstants";
import ObjectTransform from "../../../shared/object/types/objectTransform";

const syncIntervalInMillis = SIGNAL_BATCH_SEND_INTERVAL;
const syncIntervalInMillisInverse = 1 / syncIntervalInMillis;

const vec3Temp = new THREE.Vector3();

const tempObj = new THREE.Object3D();
tempObj.position.set(0, 0, 0);

export default class PeriodicTransformReceiver extends GameObjectComponent
{
    private lastSyncTime: number = 0;
    private positionInterpRange: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
    private quaternionInterpRange: [THREE.Quaternion, THREE.Quaternion] = [new THREE.Quaternion(), new THREE.Quaternion()];

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);

        if (this.gameObject.isMine())
            throw new Error("User's own object is not allowed to have the PeriodicTransformReceiver component.");

        this.lastSyncTime = performance.now();

        this.positionInterpRange[0].copy(this.gameObject.position);
        this.positionInterpRange[1].copy(this.gameObject.position);

        this.quaternionInterpRange[0].setFromEuler(this.gameObject.rotation);
        this.quaternionInterpRange[1].setFromEuler(this.gameObject.rotation);
    }

    update(deltaTime: number): void
    {
        const interpProgress =
            Math.min(
                Math.max(
                    performance.now() -  this.lastSyncTime,
                    0
                ),
                syncIntervalInMillis
            );

        const interpProgressNormalized = interpProgress * syncIntervalInMillisInverse;

        vec3Temp.lerpVectors(
            this.positionInterpRange[0], this.positionInterpRange[1], interpProgressNormalized);

        this.gameObject.position.copy(vec3Temp);
        this.gameObject.quaternion.slerpQuaternions(
            this.quaternionInterpRange[0], this.quaternionInterpRange[1], interpProgressNormalized);
    }

    setObjectTransform(transform: ObjectTransform): void
    {
        this.lastSyncTime = performance.now();

        this.positionInterpRange[0].copy(this.gameObject.position);
        this.positionInterpRange[1].set(transform.pos.x, transform.pos.y, transform.pos.z);

        vec3Temp.set(transform.dir.x, transform.dir.y, transform.dir.z);
        tempObj.lookAt(vec3Temp);

        this.quaternionInterpRange[0].setFromEuler(this.gameObject.rotation);
        this.quaternionInterpRange[1].setFromEuler(tempObj.rotation);
    }
}