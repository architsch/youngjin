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
                x: hitbox.center.x,
                y: hitbox.center.y,
                z: hitbox.center.z,
                halfSizeX: hitbox.halfSize.x,
                halfSizeY: hitbox.halfSize.y,
                halfSizeZ: hitbox.halfSize.z,
                colorHex,
            };
            if (!colliderDebugBoxMap.tryUpdate(key, () => box))
                colliderDebugBoxMap.tryAdd(key, box);
        }
    },
}

export default PhysicsDebugUtil;