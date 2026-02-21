import * as THREE from "three";
import Vec2 from "../../../shared/math/types/vec2";
import PhysicsManager from "../../../shared/physics/physicsManager";
import App from "../../app";
import GameObjectComponent from "./gameObjectComponent";
import AABB2 from "../../../shared/math/types/aabb2";

const vec3Temp = new THREE.Vector3();

export default class StaticCollider extends GameObjectComponent
{
    async onSpawn(): Promise<void>
    {
        const hitboxSize = this.componentConfig.hitboxSize;

        this.gameObject.obj.getWorldDirection(vec3Temp);
        const moreAlignedToXAxis = Math.abs(vec3Temp.x) > Math.abs(vec3Temp.z);
        const reorientedSizeX = moreAlignedToXAxis ? hitboxSize.sizeZ : hitboxSize.sizeX;
        const reorientedSizeZ = moreAlignedToXAxis ? hitboxSize.sizeX : hitboxSize.sizeZ;
        const hitbox: AABB2 = {
            x: this.gameObject.position.x,
            y: this.gameObject.position.z,
            halfSizeX: 0.5 * reorientedSizeX,
            halfSizeY: 0.5 * reorientedSizeZ,
        };

        PhysicsManager.addObject(App.getCurrentRoom()!.id,
            this.gameObject.params.objectId, this.gameObject.position.y, hitbox,
            this.componentConfig.collisionLayerMaskAtGroundLevel);
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
}