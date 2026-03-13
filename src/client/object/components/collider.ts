import * as THREE from "three";
import PhysicsManager from "../../../shared/physics/physicsManager";
import App from "../../app";
import GameObjectComponent from "./gameObjectComponent";
import PhysicsObject from "../../../shared/physics/types/physicsObject";

export default abstract class Collider extends GameObjectComponent
{
    protected physicsObject: PhysicsObject | undefined;

    async onSpawn(): Promise<void>
    {
        const colliderState = this.gameObject.params.getObjectColliderState();
        if (!colliderState)
            throw new Error(`ColliderState not found (obj: ${JSON.stringify(this.gameObject.params)})`);

        this.physicsObject = PhysicsManager.addObject(App.getCurrentRoom()!.id,
            this.gameObject.params.objectId, this.gameObject.params.objectTypeIndex, colliderState);
    }

    async onDespawn(): Promise<void>
    {
        PhysicsManager.removeObject(App.getCurrentRoom()!.id, this.gameObject.params.objectId);
    }

    forceSetTransform(position: THREE.Vector3, direction: THREE.Vector3): void
    {
        PhysicsManager.forceSetTransform(App.getCurrentRoom()!.id, this.gameObject.params.objectId,
            this.gameObject.params.objectTypeIndex, position, direction);
        this.gameObject.position = position;
        this.gameObject.direction = direction;
    }
}