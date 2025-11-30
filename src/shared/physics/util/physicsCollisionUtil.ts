import AABB2 from "../../math/types/aabb2";
import Vec2 from "../../math/types/vec2";
import PhysicsHitState from "../types/physicsHitState";
import Geometry2D from "../../math/util/geometry2D";

export function pushBoxAgainstBox(sourceHitbox: AABB2, targetPos: Vec2, targetHitbox: AABB2, hitState: PhysicsHitState): PhysicsHitState
{
    const result = Geometry2D.castAABBAgainstAABB(sourceHitbox, targetPos, targetHitbox);
    if (result.hitRayScale <= hitState.minHitRayScale)
    {
        hitState.minHitRayScale = result.hitRayScale;
        hitState.hitLine = result.hitLine;
    }
    return hitState;
}