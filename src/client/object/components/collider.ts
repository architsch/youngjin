import * as THREE from "three";
import Circle2 from "../../../shared/math/types/circle2";
import Vec2 from "../../../shared/math/types/vec2";
import PhysicsManager from "../../../shared/physics/physicsManager";
import GameObject from "../types/gameObject";
import App from "../../app";

export default class Collider
{
    private gameObject: GameObject;

    constructor(gameObject: GameObject)
    {
        this.gameObject = gameObject;

        const collisionShape: Circle2 = {
            x: this.gameObject.position.x,
            y: this.gameObject.position.z,
            radius: 0.3,
        };
        PhysicsManager.addObject(App.getCurrentRoomName(), this.gameObject.params.objectId, collisionShape, 0);
    }

    onDespawn(): void
    {
        PhysicsManager.removeObject(App.getCurrentRoomName(), this.gameObject.params.objectId);
    }

    trySetPosition(pos: THREE.Vector3): void
    {
        const targetPos: Vec2 = { x: pos.x, y: pos.z };
        const result = PhysicsManager.tryMoveObject(App.getCurrentRoomName(), this.gameObject.params.objectId, targetPos);
        this.gameObject.position.set(result.resolvedPos.x, pos.y, result.resolvedPos.y);
        if (result.desyncDetected)
            console.warn(`Physics-position desync detected.`);
    }

    forceSetPosition(pos: THREE.Vector3): void
    {
        const targetPos: Vec2 = { x: pos.x, y: pos.z };
        PhysicsManager.forceMoveObject(App.getCurrentRoomName(), this.gameObject.params.objectId, targetPos);
        this.gameObject.position.copy(pos);
    }
}