import * as THREE from "three";
import Vec3 from "../../../shared/math/types/vec3";
import { GRAVITY_SPEED } from "../../../shared/system/sharedConstants";
import Collider from "./collider";
import GameObjectComponent from "./gameObjectComponent";
import { ColliderConfig } from "../../../shared/physics/types/colliderConfig";
import ClientObjectManager from "../clientObjectManager";
import ErrorUtil from "../../../shared/system/util/errorUtil";

export default class Rigidbody extends GameObjectComponent
{
    private collider: Collider | undefined;
    private nextPosition = new THREE.Vector3();
    private nextDirection = new THREE.Vector3();

    async onSpawn(): Promise<void>
    {
        this.nextPosition.copy(this.gameObject.position);
        this.nextDirection.copy(this.gameObject.direction);

        this.collider = this.gameObject.components.collider as Collider;
        if (!this.collider)
            throw new Error("Rigidbody requires Collider component");

        const colliderConfig = this.collider.componentConfig as ColliderConfig;
        if (colliderConfig.colliderType != "rigidbody")
            throw new Error("Rigidbody requires a Collider component whose type is 'rigidobdy'");
    }

    update(deltaTime: number): void
    {
        const targetPos: Vec3 = {
            x: this.nextPosition.x,
            y: this.nextPosition.y - GRAVITY_SPEED * deltaTime,
            z: this.nextPosition.z,
        };
        const targetDir: Vec3 = {
            x: this.nextDirection.x,
            y: this.nextDirection.y,
            z: this.nextDirection.z,
        };

        try {
            // Run physics simulation
            const tr = ClientObjectManager.setObjectTransform(
                this.gameObject.params.objectId,
                targetPos, targetDir, false
            );
            this.nextPosition.set(tr.pos.x, tr.pos.y, tr.pos.z);
            this.nextDirection.set(tr.dir.x, tr.dir.y, tr.dir.z);
        } catch (err) {
            console.error(`Exception while trying to update a rigidbody :: Error: ${ErrorUtil.getErrorMessage(err)}`);
        }
    }

    tryMove(pos: THREE.Vector3, dir: THREE.Vector3): void
    {
        this.nextPosition.copy(pos);
        this.nextDirection.copy(dir);
    }
}