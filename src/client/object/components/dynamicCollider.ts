import * as THREE from "three";
import Vec2 from "../../../shared/math/types/vec2";
import PhysicsManager from "../../../shared/physics/physicsManager";
import App from "../../app";
import { MIN_OBJECT_LEVEL_CHANGE_TIME_INTERVAL, NEAR_EPSILON } from "../../../shared/system/sharedConstants";
import Collider from "./collider";

export default class DynamicCollider extends Collider
{
    private nextPosition = new THREE.Vector3();

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();
        this.nextPosition.copy(this.gameObject.position);
    }

    update(deltaTime: number): void
    {
        // physics simulation (e.g. collision handling, floor level update, etc)
        const targetPos: Vec2 = { x: this.nextPosition.x, y: this.nextPosition.z };
        const result = PhysicsManager.tryMoveObject(App.getCurrentRoom()!.id, this.gameObject.params.objectId, targetPos);
        this.gameObject.position.set(
            result.resolvedPos.x,
            this.gameObject.position.y,
            result.resolvedPos.y
        );
        this.nextPosition.copy(this.gameObject.position);
        if (result.desyncDetected)
            console.warn(`Physics-position desync detected.`);

        // y-coordinate interpolation (based on the object's updated level)
        const p = this.gameObject.position;
        const colliderInfo = this.physicsObject!.colliderInfo;
        const desiredY = colliderInfo.colliderConfig.groundLevelY + 0.5 * colliderInfo.level;
        const desiredChangeInY = desiredY - p.y;
        if (Math.abs(desiredChangeInY) > NEAR_EPSILON)
        {
            const delta = (0.5 * deltaTime / MIN_OBJECT_LEVEL_CHANGE_TIME_INTERVAL) // based on the expectation that Y shifts by 0.5 during each span of "MIN_OBJECT_LEVEL_CHANGE_TIME_INTERVAL" seconds.
                * (desiredChangeInY >= 0 ? 1 : -1);
            
            if (Math.abs(delta) >= Math.abs(desiredChangeInY))
                p.set(p.x, desiredY, p.z);
            else
                p.set(p.x, p.y + delta, p.z);
        }
    }

    trySetPosition(pos: THREE.Vector3): void
    {
        super.trySetPosition?.(pos);
        this.nextPosition.copy(pos);
    }

    forceSetPosition(pos: THREE.Vector3): void
    {
        super.forceSetPosition?.(pos);
        this.nextPosition.copy(this.gameObject.position);
    }
}