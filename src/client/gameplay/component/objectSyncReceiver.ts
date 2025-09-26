import * as THREE from "three";
import ObjectSyncParams from "../../../shared/types/networking/objectSyncParams";
import GameObject from "../object/types/gameObject";

const syncIntervalInMillis = 250;
const syncIntervalInMillisInverse = 1 / syncIntervalInMillis;
const yAxis = new THREE.Vector3(0, 1, 0);

export default class ObjectSyncReceiver
{
    private gameObject: GameObject;
    private timeInterpRange: [number, number];
    private positionInterpRange: [THREE.Vector3, THREE.Vector3];
    private quaternionInterpRange: [THREE.Quaternion, THREE.Quaternion];

    constructor(gameObject: GameObject)
    {
        this.gameObject = gameObject;

        const currTime = performance.now();
        this.timeInterpRange = [currTime, currTime];

        const p = gameObject.position;
        this.positionInterpRange = [new THREE.Vector3(p.x, p.y, p.z), new THREE.Vector3(p.x, p.y, p.z)];

        const r = gameObject.rotation;
        this.quaternionInterpRange = [new THREE.Quaternion(), new THREE.Quaternion()];
        this.quaternionInterpRange[0].setFromAxisAngle(yAxis, r.y);
        this.quaternionInterpRange[1].setFromAxisAngle(yAxis, r.y);
    }

    update(): void
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

        this.gameObject.position.lerpVectors(
            this.positionInterpRange[0], this.positionInterpRange[1], interpProgressNormalized);

        this.gameObject.quaternion.slerpQuaternions(
            this.quaternionInterpRange[0], this.quaternionInterpRange[1], interpProgressNormalized);
    }

    onSyncReceived(params: ObjectSyncParams): void
    {
        //console.log(`(ObjectSyncReceiver) onSyncReceived :: ${JSON.stringify(params)}`);

        if (this.gameObject.objectId != params.objectId)
        {
            console.error(`Object ID mismatch (this.gameObject.objectId = ${this.gameObject.objectId}, params.objectId = ${params.objectId})`);
            return;
        }

        this.timeInterpRange[0] = performance.now();
        this.timeInterpRange[1] = this.timeInterpRange[0] + syncIntervalInMillis;

        this.positionInterpRange[0].copy(this.gameObject.position);
        this.positionInterpRange[1].set(params.x, this.gameObject.position.y, params.z);

        this.quaternionInterpRange[0].setFromAxisAngle(yAxis, this.gameObject.rotation.y);
        this.quaternionInterpRange[1].setFromAxisAngle(yAxis, params.angleY);
    }
}