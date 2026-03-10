import AABB2 from "../../math/types/aabb2";
import Vec2 from "../../math/types/vec2";
import PhysicsHitState from "../types/physicsHitState";
import Geometry2DUtil from "../../math/util/geometry2DUtil";
import Vec3 from "../../math/types/vec3";
import { ColliderInfo } from "../types/colliderInfo";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";

const PhysicsCollisionUtil =
{
    getColliderInfo: (objectTypeIndex: number,
        direction: Vec3, position: Vec3): ColliderInfo | undefined =>
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
        return {hitbox, level, collisionLayerMask, colliderConfig};
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