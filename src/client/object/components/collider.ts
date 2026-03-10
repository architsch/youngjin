import * as THREE from "three";
import Vec2 from "../../../shared/math/types/vec2";
import PhysicsManager from "../../../shared/physics/physicsManager";
import App from "../../app";
import GameObjectComponent from "./gameObjectComponent";
import PhysicsObject from "../../../shared/physics/types/physicsObject";

export default abstract class Collider extends GameObjectComponent
{
    protected physicsObject: PhysicsObject | undefined;

    async onSpawn(): Promise<void>
    {
        const colliderInfo = this.gameObject.params.getColliderInfo();
        if (!colliderInfo)
            throw new Error(`ColliderInfo not found (obj: ${JSON.stringify(this.gameObject.params)})`);

        this.physicsObject = PhysicsManager.addObject(App.getCurrentRoom()!.id,
            this.gameObject.params.objectId, this.gameObject.position.y, colliderInfo);
    }

    async onDespawn(): Promise<void>
    {
        PhysicsManager.removeObject(App.getCurrentRoom()!.id, this.gameObject.params.objectId);
    }

    forceSetPosition(pos: THREE.Vector3): void
    {
        const targetPos: Vec2 = { x: pos.x, y: pos.z };
        PhysicsManager.forceMoveObject(App.getCurrentRoom()!.id, this.gameObject.params.objectId, targetPos);
        this.gameObject.position.copy(pos);
    }

    forceSetDirection(direction: THREE.Vector3): void
    {
        ;
        this.gameObject.obj.lookAt(direction);
    }
}