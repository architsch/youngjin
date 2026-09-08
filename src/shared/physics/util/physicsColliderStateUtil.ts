import AABB3 from "../../math/types/aabb3";
import Vec3 from "../../math/types/vec3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import { ColliderState } from "../types/colliderState";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import { ColliderConfig } from "../types/colliderConfig";
import PhysicsDebugUtil from "./physicsDebugUtil";
import PhysicsRoom from "../types/physicsRoom";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    VOXEL_BLOCK_HITBOX_HALFSIZE, WALL_ATTACHMENT_HITBOX_INSET } from "../../system/sharedConstants";

// Sequentially recycle each of the sets in the array (because there may be a function which uses multiple sets simultaneously).
let colliderStatesTempNextIndex = 0;
const colliderStatesTemp: Set<ColliderState>[] = [];
for (let i = 0; i < 64; ++i)
    colliderStatesTemp.push(new Set<ColliderState>());

const voxelBlockColliderConfig: ColliderConfig = {
    colliderType: "standalone",
    hitboxSize: {sizeX: 1, sizeY: 0.5, sizeZ: 1},
    applyHardCollisionToOthers: true,
    outgoingSoftCollisionForceMultiplier: 1,
    incomingSoftCollisionForceMultiplier: 0,
    maxClimbableHeight: 0,
};

const PhysicsColliderStateUtil =
{
    getVoxelBlockColliderState: (row: number, col: number, collisionLayer: number): ColliderState =>
    {
        const centerY = collisionLayer * 0.5 + 0.25;
        const state: ColliderState = {
            hitbox: {
                center: {x: 0.5 + col, y: centerY, z: 0.5 + row},
                halfSize: VOXEL_BLOCK_HITBOX_HALFSIZE,
            },
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

        // A wall attachment declares the footprint it lays claim to, and the box it is actually
        // tested with is a hair inside that (see WALL_ATTACHMENT_HITBOX_INSET). Taken off here
        // rather than written into each kind of object's own size, so that everything measuring an
        // attachment against the room — which voxel columns back it, where the grid puts it, how
        // big its outline is — goes on reading the round number it was given, and so that a
        // footprint sitting exactly on a rounding boundary cannot be tipped over it by the inset.
        //
        // Only wall attachments. The tie it settles is one they alone are placed into: they are
        // snapped to the same grid their footprints are measured in, so two of them side by side
        // share an edge exactly. A rigidbody's position is resolved rather than snapped and is
        // never edge-to-edge with anything by construction, so taking anything off it would only
        // make it smaller than it says it is — and it is the body the player stands, climbs and is
        // pushed around with.
        //
        // The two axes lying in the wall are the object's own x and y, so this is taken off before
        // the box is turned to face the way the object does. The depth is left alone: it is already
        // a sliver, and thinning it would lift the attachment off the wall it hangs on.
        const inset = colliderConfig.colliderType == "wallAttachment"
            ? WALL_ATTACHMENT_HITBOX_INSET : 0;
        const insetSizeX = Math.max(0, hitboxSize.sizeX - inset);
        const insetSizeY = Math.max(0, hitboxSize.sizeY - inset);

        const moreAlignedWithXAxis = Math.abs(direction.x) > Math.abs(direction.z);
        const reorientedSizeX = moreAlignedWithXAxis ? hitboxSize.sizeZ : insetSizeX;
        const reorientedSizeZ = moreAlignedWithXAxis ? insetSizeX : hitboxSize.sizeZ;
        const hitbox: AABB3 = {
            center: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            halfSize: {
                x: 0.5 * reorientedSizeX,
                y: 0.5 * insetSizeY,
                z: 0.5 * reorientedSizeZ
            },
        };
        const state: ColliderState = {hitbox, colliderConfig};
        PhysicsDebugUtil.tryShowColliderBox("object", state, "#ff00ff");
        return state;
    },
    findOverlappingColliderStates(physicsRoom: PhysicsRoom, hitbox: AABB3): Set<ColliderState>
    {
        const minX = hitbox.center.x - hitbox.halfSize.x;
        const maxX = hitbox.center.x + hitbox.halfSize.x;
        const minZ = hitbox.center.z - hitbox.halfSize.z;
        const maxZ = hitbox.center.z + hitbox.halfSize.z;
        const minCol = Math.max(0, Math.floor(minX));
        const maxCol = Math.min(NUM_VOXEL_COLS-1, Math.floor(maxX));
        const minRow = Math.max(0, Math.floor(minZ));
        const maxRow = Math.min(NUM_VOXEL_ROWS-1, Math.floor(maxZ));

        const set = colliderStatesTemp[colliderStatesTempNextIndex];
        colliderStatesTempNextIndex = (colliderStatesTempNextIndex + 1) % colliderStatesTemp.length;

        set.clear();

        // Global Colliders
        for (const globalCollider of physicsRoom.globalColliders)
        {
            if (Geometry3DUtil.AABBsOverlap(hitbox, globalCollider.hitbox))
                set.add(globalCollider);
        }

        // Voxel Colliders
        for (let row = minRow; row <= maxRow; ++row)
        {
            for (let col = minCol; col <= maxCol; ++col)
            {
                const physicsVoxel = physicsRoom.voxels[row * NUM_VOXEL_COLS + col];
                const voxelMask = physicsVoxel.voxel.collisionLayerMask;

                // Voxel-block hitboxes
                for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                {
                    if ((voxelMask & (1 << layer)) !== 0)
                    {
                        const voxelBlockHitbox = {
                            center: {x: col+0.5, y: 0.25 + 0.5*layer, z: row+0.5},
                            halfSize: VOXEL_BLOCK_HITBOX_HALFSIZE
                        };
                        if (Geometry3DUtil.AABBsOverlap(hitbox, voxelBlockHitbox))
                            set.add({hitbox: voxelBlockHitbox, colliderConfig: voxelBlockColliderConfig});
                    }
                }
                // Object hitboxes
                for (const object of physicsVoxel.intersectingObjects)
                {
                    const objectHitbox = object.colliderState.hitbox;
                    if (objectHitbox != hitbox &&
                        !set.has(object.colliderState) &&
                        Geometry3DUtil.AABBsOverlap(hitbox, objectHitbox))
                    {
                        set.add(object.colliderState);
                    }
                }
            }
        }
        return set;
    }
}

export default PhysicsColliderStateUtil;