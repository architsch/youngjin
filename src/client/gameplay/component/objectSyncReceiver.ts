import * as THREE from "three";
import ObjectSyncParams from "../../../shared/types/networking/objectSyncParams";
import GameObject from "../object/types/gameObject";

const syncIntervalInMillis = 200;
const syncIntervalInMillisInverse = 1 / syncIntervalInMillis;

export default class ObjectSyncReceiver
{
    private gameObject: GameObject;
    private timeInterpRange: [number, number];
    private positionInterpRange: [THREE.Vector3, THREE.Vector3];
    private quaternionInterpRange: [THREE.Quaternion, THREE.Quaternion];

    private static eulerTemp = new THREE.Euler();

    constructor(gameObject: GameObject)
    {
        this.gameObject = gameObject;

        const currTime = performance.now();
        this.timeInterpRange = [currTime, currTime];

        this.positionInterpRange = [new THREE.Vector3(), new THREE.Vector3()];
        this.positionInterpRange[0].copy(gameObject.position);
        this.positionInterpRange[1].copy(gameObject.position);

        this.quaternionInterpRange = [new THREE.Quaternion(), new THREE.Quaternion()];
        this.quaternionInterpRange[0].setFromEuler(gameObject.rotation);
        this.quaternionInterpRange[1].setFromEuler(gameObject.rotation);
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
        this.positionInterpRange[1].set(params.transform.x, params.transform.y, params.transform.z);

        ObjectSyncReceiver.eulerTemp.set(params.transform.eulerX, params.transform.eulerY, params.transform.eulerZ);
        this.quaternionInterpRange[0].setFromEuler(this.gameObject.rotation);
        this.quaternionInterpRange[1].setFromEuler(ObjectSyncReceiver.eulerTemp);
    }
}