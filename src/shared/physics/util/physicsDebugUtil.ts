import BitmaskUtil from "../../math/util/bitmaskUtil";
import { colliderDebugBoxMap, colliderDebugEnabledObservable } from "../../system/sharedObservables";
import ColliderDebugBox from "../types/colliderDebugBox";
import { ColliderState } from "../types/colliderState";

const PhysicsDebugUtil =
{
    tryShowColliderBox: (key: string, colliderState: ColliderState, colorHex: string) =>
    {
        if (colliderDebugEnabledObservable.peek())
        {
            const mask = colliderState.collisionLayerMask;
            if (!BitmaskUtil.allOnesAreContinuous(mask))
                throw new Error(`Found a discontinuous collisionLayerMask (key = ${key}, mask = ${mask.toString(2)})`);
            
            const colliderSizeY = 0.5 * BitmaskUtil.countOnes(mask);
            const colliderHalfSizeY = 0.5 * colliderSizeY;
            const colliderMinY = 0.5 * colliderState.level;
            const colliderCenterY = colliderMinY + colliderHalfSizeY;

            const box: ColliderDebugBox = {
                x: colliderState.hitbox.x, y: colliderCenterY, z: colliderState.hitbox.y,
                halfSizeX: colliderState.hitbox.halfSizeX,
                halfSizeY: colliderHalfSizeY,
                halfSizeZ: colliderState.hitbox.halfSizeY,
                colorHex,
            };
            if (!colliderDebugBoxMap.tryUpdate(key, () => box))
                colliderDebugBoxMap.tryAdd(key, box);
        }
    },
}

export default PhysicsDebugUtil;