import AABB3 from "../../math/types/aabb3";
import Vec3 from "../../math/types/vec3";
import PhysicsHitState from "../types/physicsHitState";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import { ColliderState } from "../types/colliderState";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import { ColliderConfig } from "../types/colliderConfig";
import PhysicsDebugUtil from "./physicsDebugUtil";

const voxelBlockColliderConfig: ColliderConfig = {
    colliderType: "standalone",
    hitboxSize: {sizeX: 1, sizeY: 0.5, sizeZ: 1},
};

const PhysicsCollisionUtil =
{
    getVoxelBlockColliderState: (row: number, col: number, collisionLayer: number): ColliderState =>
    {
        const centerY = collisionLayer * 0.5 + 0.25;
        const state: ColliderState = {
            hitbox: { x: 0.5 + col, y: centerY, z: 0.5 + row, halfSizeX: 0.5, halfSizeY: 0.25, halfSizeZ: 0.5 },
            colliderConfig: voxelBlockColliderConfig
        };
        PhysicsDebugUtil.tryShowColliderBox("voxelBlock", state, "#ffff00");
        return state;
    },
    getObjectColliderState: (objectTypeIndex: number,
        position: Vec3, direction: Vec3): ColliderState | undefined =>
    {
        const objectTypeConfig = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex);
        const components = objectTypeConfig.components;
        let colliderConfig = components.spawnedByAny?.collider;
        if (!colliderConfig)
            return undefined;
        const hitboxSize = colliderConfig.hitboxSize;
        const moreAlignedWithXAxis = Math.abs(direction.x) > Math.abs(direction.z);
        const reorientedSizeX = moreAlignedWithXAxis ? hitboxSize.sizeZ : hitboxSize.sizeX;
        const reorientedSizeZ = moreAlignedWithXAxis ? hitboxSize.sizeX : hitboxSize.sizeZ;
        const hitbox: AABB3 = {
            x: position.x,
            y: position.y,
            z: position.z,
            halfSizeX: 0.5 * reorientedSizeX,
            halfSizeY: 0.5 * hitboxSize.sizeY,
            halfSizeZ: 0.5 * reorientedSizeZ,
        };
        const state: ColliderState = {hitbox, colliderConfig};
        PhysicsDebugUtil.tryShowColliderBox("object", state, "#ff00ff");
        return state;
    },
    pushBoxAgainstBox: (sourceHitbox: AABB3, targetPos: Vec3, targetHitbox: AABB3, hitState: PhysicsHitState): PhysicsHitState =>
    {
        const result = Geometry3DUtil.castAABBAgainstAABB(sourceHitbox, targetPos, targetHitbox);
        if (result.hitRayScale <= hitState.minHitRayScale)
        {
            hitState.minHitRayScale = result.hitRayScale;
            hitState.hitNormal = result.hitNormal;
        }
        return hitState;
    }
}

export default PhysicsCollisionUtil;