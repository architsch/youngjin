import { colliderDebugBoxMap, colliderDebugEnabledObservable } from "../../system/sharedObservables";
import ColliderDebugBox from "../types/colliderDebugBox";
import { ColliderState } from "../types/colliderState";

const PhysicsDebugUtil =
{
    tryShowColliderBox: (key: string, colliderState: ColliderState, colorHex: string) =>
    {
        if (colliderDebugEnabledObservable.peek())
        {
            const hitbox = colliderState.hitbox;
            const box: ColliderDebugBox = {
                x: hitbox.x,
                y: hitbox.y,
                z: hitbox.z,
                halfSizeX: hitbox.halfSizeX,
                halfSizeY: hitbox.halfSizeY,
                halfSizeZ: hitbox.halfSizeZ,
                colorHex,
            };
            if (!colliderDebugBoxMap.tryUpdate(key, () => box))
                colliderDebugBoxMap.tryAdd(key, box);
        }
    },
}

export default PhysicsDebugUtil;