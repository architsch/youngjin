import * as THREE from "three";
import Vec3 from "../../../shared/math/types/vec3";
import PhysicsManager from "../../../shared/physics/physicsManager";
import App from "../../app";
import { GRAVITY_SPEED, NEAR_EPSILON } from "../../../shared/system/sharedConstants";
import Collider from "./collider";

export default class DynamicCollider extends Collider
{
    private nextPosition = new THREE.Vector3();
    private nextDirection = new THREE.Vector3();

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();
        this.nextPosition.copy(this.gameObject.position);
        this.nextDirection.copy(this.gameObject.direction);
    }

    update(deltaTime: number): void
    {
        // Compute the target position with gravity applied
        const physicsY = this.physicsObject!.colliderState.hitbox.y
            - this.physicsObject!.colliderState.hitbox.halfSizeY; // bottom Y of physics hitbox
        const gravityY = physicsY - GRAVITY_SPEED * deltaTime;

        const targetPos: Vec3 = {
            x: this.nextPosition.x,
            y: gravityY, // base Y (foot position) — trySetTransform expects base Y
            z: this.nextPosition.z,
        };
        const targetDir: Vec3 = {
            x: this.nextDirection.x,
            y: this.nextDirection.y,
            z: this.nextDirection.z,
        };

        // Physics simulation (3D collision handling, step-up, gravity)
        const result = PhysicsManager.trySetTransform(
            App.getCurrentRoom()!.id,
            this.gameObject.params.objectId,
            this.gameObject.params.objectTypeIndex,
            targetPos, targetDir
        );

        // Apply XZ directly
        this.gameObject.position.set(
            result.resolvedPos.x,
            this.gameObject.position.y,
            result.resolvedPos.z
        );
        this.nextPosition.copy(this.gameObject.position);

        if (result.desyncDetected)
            console.warn(`Physics-position desync detected.`);

        // Y-coordinate interpolation (smooth visual transition toward the physics-resolved Y)
        const p = this.gameObject.position;
        const desiredY = result.resolvedPos.y; // already base Y (foot position)
        const desiredChangeInY = desiredY - p.y;
        if (Math.abs(desiredChangeInY) > NEAR_EPSILON)
        {
            const speed = Math.max(Math.abs(desiredChangeInY) / 0.15, 5); // at least 5 units/sec, or fast enough to reach in 0.15s
            const delta = speed * deltaTime * (desiredChangeInY >= 0 ? 1 : -1);

            if (Math.abs(delta) >= Math.abs(desiredChangeInY))
                p.set(p.x, desiredY, p.z);
            else
                p.set(p.x, p.y + delta, p.z);
        }
    }

    trySetTransform(pos: THREE.Vector3, dir: THREE.Vector3): void
    {
        this.nextPosition.copy(pos);
        this.nextDirection.copy(dir);
    }

    forceSetTransform(position: THREE.Vector3, direction: THREE.Vector3): void
    {
        super.forceSetTransform?.(position, direction);
        this.nextPosition.copy(this.gameObject.position);
        this.nextDirection.copy(this.gameObject.direction);
    }
}