import * as THREE from "three";
import Vec3 from "../../../shared/math/types/vec3";
import { GRAVITY_SPEED } from "../../../shared/system/sharedConstants";
import Collider from "./collider";
import GameObjectComponent from "./gameObjectComponent";
import GameObject from "../types/gameObject";
import { ColliderConfig } from "../../../shared/physics/types/colliderConfig";
import ClientObjectManager from "../clientObjectManager";

export default class PhysicsUpdater extends GameObjectComponent
{
    private collider: Collider;
    private nextPosition = new THREE.Vector3();
    private nextDirection = new THREE.Vector3();

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);

        this.collider = this.gameObject.components.collider as Collider;
        if (!this.collider)
            throw new Error("PhysicsUpdater requires Collider component");

        const colliderConfig = this.collider.componentConfig as ColliderConfig;
        if (colliderConfig.colliderType != "rigidbody")
            throw new Error("PhysicsUpdater requires a Collider component whose type is 'rigidobdy'");
    }

    async onSpawn(): Promise<void>
    {
        this.nextPosition.copy(this.gameObject.position);
        this.nextDirection.copy(this.gameObject.direction);
    }

    update(deltaTime: number): void
    {
        const colliderConfig = this.collider.componentConfig as ColliderConfig;
        const bottomY = this.gameObject.position.y - 0.5 * colliderConfig.hitboxSize.sizeY;

        const targetPos: Vec3 = {
            x: this.nextPosition.x,
            y: bottomY - GRAVITY_SPEED * deltaTime,
            z: this.nextPosition.z,
        };
        const targetDir: Vec3 = {
            x: this.nextDirection.x,
            y: this.nextDirection.y,
            z: this.nextDirection.z,
        };

        // Physics simulation (3D collision handling, step-up, gravity)
        const tr = ClientObjectManager.setObjectTransform(
            this.gameObject.params.objectId,
            targetPos, targetDir, false
        );
        this.nextPosition.set(tr.pos.x, tr.pos.y, tr.pos.z);
        this.nextDirection.set(tr.dir.x, tr.dir.y, tr.dir.z);
    }

    tryMove(pos: THREE.Vector3, dir: THREE.Vector3): void
    {
        this.nextPosition.copy(pos);
        this.nextDirection.copy(dir);
    }
}