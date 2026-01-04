import * as THREE from "three";
import Vec2 from "../../../shared/math/types/vec2";
import PhysicsManager from "../../../shared/physics/physicsManager";
import App from "../../app";
import GameObjectComponent from "./gameObjectComponent";
import AABB2 from "../../../shared/math/types/aabb2";
import PhysicsObject from "../../../shared/physics/types/physicsObject";
import { MIN_OBJECT_LEVEL_CHANGE_INTERVAL, NEAR_EPSILON } from "../../../shared/system/constants";

const vec3Temp = new THREE.Vector3();

export default class Collider extends GameObjectComponent
{
    private physicsObject: PhysicsObject | undefined;
    private groundLevelObjectY: number = 0;

    async onSpawn(): Promise<void>
    {
        this.groundLevelObjectY = this.gameObject.position.y;
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

        this.physicsObject = PhysicsManager.addObject(App.getCurrentRoom()!.roomID,
            this.gameObject.params.objectId, hitbox, this.componentConfig.collisionLayerMaskAtGroundLevel);
    }

    async onDespawn(): Promise<void>
    {
        PhysicsManager.removeObject(App.getCurrentRoom()!.roomID, this.gameObject.params.objectId);
    }

    update(deltaTime: number): void
    {
        const p = this.gameObject.position;
        const desiredY = this.groundLevelObjectY + 0.5 * this.physicsObject!.level;
        const desiredChangeInY = desiredY - p.y;
        //console.log(this.physicsObject!.level);
        
        if (Math.abs(desiredChangeInY) > NEAR_EPSILON)
        {
            const delta = (0.5 * deltaTime / MIN_OBJECT_LEVEL_CHANGE_INTERVAL) // based on the expectation that Y change change by 0.5 during a span of "MIN_OBJECT_LEVEL_CHANGE_INTERVAL" seconds.
                * (desiredChangeInY >= 0 ? 1 : -1);
            
            if (Math.abs(delta) >= Math.abs(desiredChangeInY))
                p.set(p.x, desiredY, p.z);
            else
                p.set(p.x, p.y + delta, p.z);
        }
    }

    trySetPosition(pos: THREE.Vector3): void
    {
        const targetPos: Vec2 = { x: pos.x, y: pos.z };
        const result = PhysicsManager.tryMoveObject(App.getCurrentRoom()!.roomID, this.gameObject.params.objectId, targetPos);
        this.gameObject.position.set(result.resolvedPos.x, pos.y, result.resolvedPos.y);
        if (result.desyncDetected)
            console.warn(`Physics-position desync detected.`);
    }

    forceSetPosition(pos: THREE.Vector3): void
    {
        const targetPos: Vec2 = { x: pos.x, y: pos.z };
        PhysicsManager.forceMoveObject(App.getCurrentRoom()!.roomID, this.gameObject.params.objectId, targetPos);
        this.gameObject.position.copy(pos);
    }
}