import * as THREE from "three";
import ObjectSyncParams from "../../../shared/object/types/objectSyncParams";
import ObjectDesyncResolveParams from "../../../shared/object/types/objectDesyncResolveParams";
import GameObjectComponent from "./gameObjectComponent";

const syncIntervalInMillis = 200;
const syncIntervalInMillisInverse = 1 / syncIntervalInMillis;

const vec3Temp = new THREE.Vector3();
const eulerTemp = new THREE.Euler();

export default class ObjectSyncReceiver extends GameObjectComponent
{
    private timeInterpRange: [number, number] = [0, 0];
    private positionInterpRange: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
    private quaternionInterpRange: [THREE.Quaternion, THREE.Quaternion] = [new THREE.Quaternion(), new THREE.Quaternion()];

    async onSpawn(): Promise<void>
    {
        if (this.gameObject.isMine())
            throw new Error("User's own object is not allowed to have the ObjectSyncEmitter component.");

        const currTime = performance.now();
        this.timeInterpRange[0] = currTime;
        this.timeInterpRange[1] = currTime;

        this.positionInterpRange[0].copy(this.gameObject.position);
        this.positionInterpRange[1].copy(this.gameObject.position);

        this.quaternionInterpRange[0].setFromEuler(this.gameObject.rotation);
        this.quaternionInterpRange[1].setFromEuler(this.gameObject.rotation);
    }

    async onDespawn(): Promise<void>
    {
    }

    update(deltaTime: number): void
    {
        const currTime = performance.now();

        const interpProgress =
            Math.min(
                Math.max(
                    currTime -  this.timeInterpRange[0],
                    0
                ),
                syncIntervalInMillis
            );

        const interpProgressNormalized = interpProgress * syncIntervalInMillisInverse;

        vec3Temp.lerpVectors(
            this.positionInterpRange[0], this.positionInterpRange[1], interpProgressNormalized);
        this.gameObject.forceSetPosition(vec3Temp);

        this.gameObject.quaternion.slerpQuaternions(
            this.quaternionInterpRange[0], this.quaternionInterpRange[1], interpProgressNormalized);
    }

    onObjectDesyncResolveReceived(params: ObjectDesyncResolveParams): void
    {
        const p = params.resolvedPos;
        vec3Temp.set(p.x, this.gameObject.position.y, p.y);
        this.gameObject.forceSetPosition(vec3Temp);
        
        this.positionInterpRange[0].copy(vec3Temp);
        this.positionInterpRange[1].copy(vec3Temp);

        const currTime = performance.now();
        this.timeInterpRange = [currTime, currTime];
    }

    onObjectSyncReceived(params: ObjectSyncParams): void
    {
        //console.log(`(ObjectSyncReceiver) onObjectSyncReceived :: ${JSON.stringify(params)}`);

        if (this.gameObject.params.objectId != params.objectId)
        {
            console.error(`Object ID mismatch (this.gameObject.objectId = ${this.gameObject.params.objectId}, params.objectId = ${params.objectId})`);
            return;
        }

        this.timeInterpRange[0] = performance.now();
        this.timeInterpRange[1] = this.timeInterpRange[0] + syncIntervalInMillis;

        this.positionInterpRange[0].copy(this.gameObject.position);
        this.positionInterpRange[1].set(params.transform.x, params.transform.y, params.transform.z);

        eulerTemp.set(params.transform.eulerX, params.transform.eulerY, params.transform.eulerZ);
        this.quaternionInterpRange[0].setFromEuler(this.gameObject.rotation);
        this.quaternionInterpRange[1].setFromEuler(eulerTemp);
    }
}