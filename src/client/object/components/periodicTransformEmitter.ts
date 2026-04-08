import * as THREE from "three";
import SetObjectTransformSignal from "../../../shared/object/types/setObjectTransformSignal";
import SocketsClient from "../../networking/client/socketsClient";
import GameObjectComponent from "./gameObjectComponent";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import GameObject from "../types/gameObject";
import { SIGNAL_BATCH_SEND_INTERVAL } from "../../../shared/system/sharedConstants";
import PhysicsColliderStateUtil from "../../../shared/physics/util/physicsColliderStateUtil";
import App from "../../app";

const syncIntervalInMillis = SIGNAL_BATCH_SEND_INTERVAL;

const minSyncDistSqr = 0.0001;
const minSyncAngle = 0.01;

const vec3Temp = new THREE.Vector3();

export default class PeriodicTransformEmitter extends GameObjectComponent
{
    private ignorePhysics: boolean;
    private lastSyncTime: number = 0;
    private lastSyncedPosition: THREE.Vector3 = new THREE.Vector3();
    private lastSyncedRotation: THREE.Euler = new THREE.Euler();
    private roomID: string;

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);

        if (!this.gameObject.isMine())
            throw new Error("Only the user's own object is allowed to have the FirstPersonController component.");

        const colliderState = PhysicsColliderStateUtil.getObjectColliderState(
            this.gameObject.params.objectTypeIndex,
            this.gameObject.params.transform.pos,
            this.gameObject.params.transform.dir);
        this.ignorePhysics = !colliderState || colliderState.colliderConfig.colliderType != "rigidbody";

        this.lastSyncTime = performance.now();
        this.lastSyncedPosition.copy(this.gameObject.position);
        this.lastSyncedRotation.copy(this.gameObject.rotation);

        this.roomID = App.getCurrentRoom()!.id;
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
                const params = new SetObjectTransformSignal(
                    this.roomID,
                    this.gameObject.params.objectId,
                    new ObjectTransform(
                        {x: this.lastSyncedPosition.x, y: this.lastSyncedPosition.y, z: this.lastSyncedPosition.z},
                        {x: vec3Temp.x, y: vec3Temp.y, z: vec3Temp.z}
                    ),
                    this.ignorePhysics
                );
                SocketsClient.emitSetObjectTransformSignal(params);
            }
        }
    }
}