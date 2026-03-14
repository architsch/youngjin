import AABB2 from "../../math/types/aabb2";
import Vec2 from "../../math/types/vec2";
import PhysicsHitState from "../types/physicsHitState";
import Geometry2DUtil from "../../math/util/geometry2DUtil";
import Vec3 from "../../math/types/vec3";
import { ColliderState } from "../types/colliderState";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import { ColliderConfig } from "../types/colliderConfig";
import PhysicsDebugUtil from "./physicsDebugUtil";

const voxelBlockColliderConfig: ColliderConfig = {
    collisionLayerMaskAtGroundLevel: 1,
    groundLevelY: 0,
    hitboxSize: {sizeX: 1, sizeZ: 1},
};

const PhysicsCollisionUtil =
{
    getVoxelBlockColliderState: (row: number, col: number, collisionLayer: number): ColliderState =>
    {
        const state: ColliderState = {
            hitbox: { x: 0.5 + col, y: 0.5 + row, halfSizeX: 0.5, halfSizeY: 0.5 },
            level: collisionLayer,
            collisionLayerMask: 1 << collisionLayer,
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
        let colliderConfig = components.spawnedByAny?.dynamicCollider;
        if (!colliderConfig)
            colliderConfig = components.spawnedByAny?.staticCollider;
        if (!colliderConfig)
            return undefined;
        const hitboxSize = colliderConfig.hitboxSize;
        const moreAlignedWithXAxis = Math.abs(direction.x) > Math.abs(direction.z);
        const reorientedSizeX = moreAlignedWithXAxis ? hitboxSize.sizeZ : hitboxSize.sizeX;
        const reorientedSizeZ = moreAlignedWithXAxis ? hitboxSize.sizeX : hitboxSize.sizeZ;
        const hitbox: AABB2 = {
            x: position.x,
            y: position.z,
            halfSizeX: 0.5 * reorientedSizeX,
            halfSizeY: 0.5 * reorientedSizeZ,
        };
        const level = Math.round(2 * (position.y - colliderConfig.groundLevelY)); // Multiplying by 2 because each level is 0.5 high.
        const collisionLayerMask = colliderConfig.collisionLayerMaskAtGroundLevel << level;
        const state: ColliderState = {hitbox, level, collisionLayerMask, colliderConfig};
        PhysicsDebugUtil.tryShowColliderBox("object", state, "#ff00ff");
        return state;
    },
    pushBoxAgainstBox: (sourceHitbox: AABB2, targetPos: Vec2, targetHitbox: AABB2, hitState: PhysicsHitState): PhysicsHitState =>
    {
        const result = Geometry2DUtil.castAABBAgainstAABB(sourceHitbox, targetPos, targetHitbox);
        if (result.hitRayScale <= hitState.minHitRayScale)
        {
            hitState.minHitRayScale = result.hitRayScale;
            hitState.hitLine = result.hitLine;
        }
        return hitState;
    }
}

export default PhysicsCollisionUtil;