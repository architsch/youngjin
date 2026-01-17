import * as THREE from "three";
import ObjectSyncParams from "../../../shared/object/types/objectSyncParams";
import GameSocketsClient from "../../networking/client/gameSocketsClient";
import ObjectDesyncResolveParams from "../../../shared/object/types/objectDesyncResolveParams";
import GameObjectComponent from "./gameObjectComponent";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import GameObject from "../types/gameObject";
import { objectDesyncResolveObservable } from "../../system/clientObservables";
import { SIGNAL_BATCH_SEND_INTERVAL } from "../../../shared/system/constants";

const syncIntervalInMillis = SIGNAL_BATCH_SEND_INTERVAL;

const minSyncDistSqr = 0.0001;
const minSyncAngle = 0.01;

const vec3Temp = new THREE.Vector3();

export default class ObjectSyncEmitter extends GameObjectComponent
{
    private lastSyncTime: number = 0;
    private lastSyncedPosition: THREE.Vector3 = new THREE.Vector3();
    private lastSyncedRotation: THREE.Euler = new THREE.Euler();

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);

        if (!this.gameObject.isMine())
            throw new Error("Only the user's own object is allowed to have the FirstPersonController component.");

        this.lastSyncTime = performance.now();
        this.lastSyncedPosition.copy(this.gameObject.position);
        this.lastSyncedRotation.copy(this.gameObject.rotation);

        this.onObjectDesyncResolveReceived = this.onObjectDesyncResolveReceived.bind(this);
    }

    async onSpawn(): Promise<void>
    {
        objectDesyncResolveObservable.addListener(this.gameObject.params.objectId, this.onObjectDesyncResolveReceived); 
    }

    async onDespawn(): Promise<void>
    {
        objectDesyncResolveObservable.removeListener(this.gameObject.params.objectId);
    }

    update(deltaTime: number)
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

                vec3Temp.setFromEuler(this.lastSyncedRotation).normalize();
                this.gameObject.obj.getWorldDirection(vec3Temp);
                const params = new ObjectSyncParams(
                    this.gameObject.params.objectId,
                    new ObjectTransform(
                        this.lastSyncedPosition.x,
                        this.lastSyncedPosition.y,
                        this.lastSyncedPosition.z,
                        vec3Temp.x,
                        vec3Temp.y,
                        vec3Temp.z
                    )
                );
                GameSocketsClient.emitObjectSync(params);
                //console.log(`(ObjectSyncEmitter) emitObjectSync :: ${JSON.stringify(params)}`);
            }
        }
    }

    private onObjectDesyncResolveReceived(params: ObjectDesyncResolveParams): void
    {
        const p = params.resolvedPos;
        vec3Temp.set(p.x, this.gameObject.position.y, p.y);
        this.gameObject.forceSetPosition(vec3Temp);
        
        this.lastSyncedPosition.copy(vec3Temp);
        this.lastSyncTime = performance.now();
    }
}