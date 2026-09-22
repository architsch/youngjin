import AABB3 from "../../math/types/aabb3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import { ColliderState } from "../types/colliderState";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import ObjectScaleUtil from "../../object/util/objectScaleUtil";
// Type-only: the transform is the carrier of position, facing and scale.
import type ObjectTransform from "../../object/types/objectTransform";
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
    baseHitboxSize: {sizeX: 1, sizeY: 0.5, sizeZ: 1},
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
        transform: ObjectTransform): ColliderState | undefined =>
    {
        const objectTypeConfig = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex);
        const components = objectTypeConfig.components;
        let colliderConfig = components.spawnedByAny?.collider;
        if (!colliderConfig)
            return undefined;
        // This object's own footprint, not the type's: the scale is applied before anything else, so the
        // inset below stays an absolute distance whatever size the object is.
        const hitboxSize = ObjectScaleUtil.getObjectSize(objectTypeIndex, transform.scale);
        const direction = transform.dir;

        // Wall attachments get a slightly inset test box (WALL_ATTACHMENT_HITBOX_INSET), so neighbours
        // sharing an edge don't register as overlapping, while everything else reads the round footprint.
        // Not applied to rigidbodies (never snapped edge-to-edge). Inset on the in-wall x/y axes before
        // rotation; depth is untouched so attachments stay on the wall.
        const inset = colliderConfig.colliderType == "wallAttachment"
            ? WALL_ATTACHMENT_HITBOX_INSET : 0;
        const insetSizeX = Math.max(0, hitboxSize.x - inset);
        const insetSizeY = Math.max(0, hitboxSize.y - inset);

        const moreAlignedWithXAxis = Math.abs(direction.x) > Math.abs(direction.z);
        const reorientedSizeX = moreAlignedWithXAxis ? hitboxSize.z : insetSizeX;
        const reorientedSizeZ = moreAlignedWithXAxis ? insetSizeX : hitboxSize.z;
        const hitbox: AABB3 = {
            center: {
                x: transform.pos.x,
                y: transform.pos.y,
                z: transform.pos.z
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