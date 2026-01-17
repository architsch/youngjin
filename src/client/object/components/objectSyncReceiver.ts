import * as THREE from "three";
import ObjectSyncParams from "../../../shared/object/types/objectSyncParams";
import ObjectDesyncResolveParams from "../../../shared/object/types/objectDesyncResolveParams";
import GameObjectComponent from "./gameObjectComponent";
import GameObject from "../types/gameObject";
import { objectDesyncResolveObservable, objectSyncObservable } from "../../system/clientObservables";
import { SIGNAL_BATCH_SEND_INTERVAL } from "../../../shared/system/constants";

const syncIntervalInMillis = SIGNAL_BATCH_SEND_INTERVAL;
const syncIntervalInMillisInverse = 1 / syncIntervalInMillis;

const vec3Temp = new THREE.Vector3();

const tempObj = new THREE.Object3D();
tempObj.position.set(0, 0, 0);

export default class ObjectSyncReceiver extends GameObjectComponent
{
    private lastSyncTime: number = 0;
    private positionInterpRange: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
    private quaternionInterpRange: [THREE.Quaternion, THREE.Quaternion] = [new THREE.Quaternion(), new THREE.Quaternion()];

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);

        if (this.gameObject.isMine())
            throw new Error("User's own object is not allowed to have the ObjectSyncEmitter component.");

        this.lastSyncTime = performance.now();

        this.positionInterpRange[0].copy(this.gameObject.position);
        this.positionInterpRange[1].copy(this.gameObject.position);

        this.quaternionInterpRange[0].setFromEuler(this.gameObject.rotation);
        this.quaternionInterpRange[1].setFromEuler(this.gameObject.rotation);

        this.onObjectDesyncResolveReceived = this.onObjectDesyncResolveReceived.bind(this);
        this.onObjectSyncReceived = this.onObjectSyncReceived.bind(this);
    }

    async onSpawn(): Promise<void>
    {
        objectDesyncResolveObservable.addListener(this.gameObject.params.objectId, this.onObjectDesyncResolveReceived);
        objectSyncObservable.addListener(this.gameObject.params.objectId, this.onObjectSyncReceived);
    }

    async onDespawn(): Promise<void>
    {
        objectDesyncResolveObservable.removeListener(this.gameObject.params.objectId);
        objectSyncObservable.removeListener(this.gameObject.params.objectId);
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
        this.gameObject.forceSetPosition(vec3Temp);

        this.gameObject.quaternion.slerpQuaternions(
            this.quaternionInterpRange[0], this.quaternionInterpRange[1], interpProgressNormalized);
    }

    private onObjectDesyncResolveReceived(params: ObjectDesyncResolveParams): void
    {
        if (this.gameObject.params.objectId != params.objectId)
        {
            console.error(`Object ID mismatch (this.gameObject.objectId = ${this.gameObject.params.objectId}, params.objectId = ${params.objectId})`);
            return;
        }
        const p = params.resolvedPos;
        vec3Temp.set(p.x, this.gameObject.position.y, p.y);
        this.gameObject.forceSetPosition(vec3Temp);
        
        this.positionInterpRange[0].copy(vec3Temp);
        this.positionInterpRange[1].copy(vec3Temp);

        this.lastSyncTime = performance.now();
    }

    private onObjectSyncReceived(params: ObjectSyncParams): void
    {
        //console.log(`(ObjectSyncReceiver) onObjectSyncReceived :: ${JSON.stringify(params)}`);

        if (this.gameObject.params.objectId != params.objectId)
        {
            console.error(`Object ID mismatch (this.gameObject.objectId = ${this.gameObject.params.objectId}, params.objectId = ${params.objectId})`);
            return;
        }
        this.lastSyncTime = performance.now();

        this.positionInterpRange[0].copy(this.gameObject.position);
        this.positionInterpRange[1].set(params.transform.x, params.transform.y, params.transform.z);

        vec3Temp.set(params.transform.dirX, params.transform.dirY, params.transform.dirZ);
        tempObj.lookAt(vec3Temp);

        this.quaternionInterpRange[0].setFromEuler(this.gameObject.rotation);
        this.quaternionInterpRange[1].setFromEuler(tempObj.rotation);
    }
}