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
    private velocity: Vec3 = { x: 0, y: 0, z: 0 };

    async onSpawn(): Promise<void>
    {
        this.collider = this.gameObject.components.collider as Collider;
        if (!this.collider)
            throw new Error("Rigidbody requires Collider component");

        const colliderConfig = this.collider.componentConfig as ColliderConfig;
        if (colliderConfig.colliderType != "rigidbody")
            throw new Error("Rigidbody requires a Collider component whose type is 'rigidobdy'");
    }

    update(deltaTime: number): void
    {
        // Apply gravity to velocity
        this.velocity.y -= GRAVITY_SPEED * deltaTime;

        // Compute target position from current position + velocity
        const currentPos: Vec3 = {
            x: this.gameObject.position.x,
            y: this.gameObject.position.y,
            z: this.gameObject.position.z,
        };
        const targetPos: Vec3 = {
            x: currentPos.x + this.velocity.x * deltaTime,
            y: currentPos.y + this.velocity.y * deltaTime,
            z: currentPos.z + this.velocity.z * deltaTime,
        };
        const targetDir: Vec3 = {
            x: this.gameObject.direction.x,
            y: this.gameObject.direction.y,
            z: this.gameObject.direction.z,
        };

        try {
            // Run physics simulation
            const tr = ClientObjectManager.setObjectTransform(
                this.gameObject.params.objectId,
                targetPos, targetDir, false
            );

            // Derive effective velocity from physics resolution
            if (deltaTime > 0)
            {
                this.velocity.x = (tr.pos.x - currentPos.x) / deltaTime;
                this.velocity.y = (tr.pos.y - currentPos.y) / deltaTime;
                this.velocity.z = (tr.pos.z - currentPos.z) / deltaTime;
            }
        } catch (err) {
            console.error(`Exception while trying to update a rigidbody :: Error: ${ErrorUtil.getErrorMessage(err)}`);
        }
    }

    tryMove(velocityX: number, velocityZ: number): void
    {
        this.velocity.x = velocityX;
        this.velocity.z = velocityZ;
    }
}