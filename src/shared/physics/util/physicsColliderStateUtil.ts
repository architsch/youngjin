import AABB3 from "../../math/types/aabb3";
import Vec3 from "../../math/types/vec3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import { ColliderState } from "../types/colliderState";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import ObjectScaleUtil from "../../object/util/objectScaleUtil";
// Type-only: the transform is the carrier of position, facing and scale.
import type ObjectTransform from "../../object/types/objectTransform";
import { ColliderConfig } from "../types/colliderConfig";
import PhysicsDebugUtil from "./physicsDebugUtil";
import PhysicsVoxelUtil from "./physicsVoxelUtil";
import PhysicsRoom from "../types/physicsRoom";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import { ATTACHMENT_HITBOX_INSET, COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS, VOXEL_CELL_SIZE, ZERO_VEC3 } from "../../system/sharedConstants";

// Sequentially recycle each of the sets in the array (because there may be a function which uses multiple sets simultaneously).
let colliderStatesTempNextIndex = 0;
const colliderStatesTemp: Set<ColliderState>[] = [];
for (let i = 0; i < 64; ++i)
    colliderStatesTemp.push(new Set<ColliderState>());

const voxelBlockColliderConfig: ColliderConfig = {
    baseHitboxSize: {sizeX: VOXEL_CELL_SIZE, sizeY: COLLISION_LAYER_HEIGHT, sizeZ: VOXEL_CELL_SIZE},
    applyHardCollisionToOthers: true,
    outgoingSoftCollisionForceMultiplier: 1,
    incomingSoftCollisionForceMultiplier: 0,
    maxClimbableHeight: 0,
};

const PhysicsColliderStateUtil =
{
    getVoxelBlockColliderState: (row: number, col: number, collisionLayer: number): ColliderState =>
    {
        const state: ColliderState = {
            hitbox: VoxelQueryUtil.getVoxelBlockBox(row, col, collisionLayer),
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
        // This object's own footprint, not the type's: the scale is applied before anything else, so an
        // attached object's inset stays an absolute distance whatever size the object is.
        const hitboxSize = ObjectScaleUtil.getObjectSize(objectTypeIndex, transform.scale);
        // An object that stands out from its face has its origin on the face and its box in front of it (see
        // ObjectAttachmentConfig.standsOut).
        const standOutDist = objectTypeConfig.attachment?.standsOut ? 0.5 * hitboxSize.z : 0;
        const standOutDir = (standOutDist > 0) ? Geometry3DUtil.getAxisFacingBasis(transform.dir).normal : ZERO_VEC3;
        const hitbox: AABB3 = {
            center: {
                x: transform.pos.x + standOutDist * standOutDir.x,
                y: transform.pos.y + standOutDist * standOutDir.y,
                z: transform.pos.z + standOutDist * standOutDir.z
            },
            halfSize: objectTypeConfig.attachment
                ? getAttachedHalfSize(hitboxSize, transform.dir)
                : getFreeStandingHalfSize(hitboxSize, transform.dir),
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
        const minCol = Math.max(0, VoxelQueryUtil.getVoxelColFromWorldX(minX));
        const maxCol = Math.min(NUM_VOXEL_COLS-1, VoxelQueryUtil.getVoxelColFromWorldX(maxX));
        const minRow = Math.max(0, VoxelQueryUtil.getVoxelRowFromWorldZ(minZ));
        const maxRow = Math.min(NUM_VOXEL_ROWS-1, VoxelQueryUtil.getVoxelRowFromWorldZ(maxZ));
        const minLayer = Math.max(COLLISION_LAYER_MIN,
            VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(hitbox.center.y - hitbox.halfSize.y));
        const maxLayer = Math.min(COLLISION_LAYER_MAX,
            VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(hitbox.center.y + hitbox.halfSize.y));

        const set = colliderStatesTemp[colliderStatesTempNextIndex];
        colliderStatesTempNextIndex = (colliderStatesTempNextIndex + 1) % colliderStatesTemp.length;

        set.clear();

        // Global Colliders
        for (const globalCollider of physicsRoom.globalColliders)
        {
            if (Geometry3DUtil.AABBsOverlap(hitbox, globalCollider.hitbox))
                set.add(globalCollider);
        }

        // Voxel-block hitboxes, from the room's grid as it stands.
        const voxels = physicsRoom.room.voxelGrid.voxels;
        for (let row = minRow; row <= maxRow; ++row)
        {
            for (let col = minCol; col <= maxCol; ++col)
            {
                const blockLayerMask = voxels[row * NUM_VOXEL_COLS + col].blockLayerMask;
                for (let layer = minLayer; layer <= maxLayer; ++layer)
                {
                    if ((blockLayerMask & (1 << layer)) != 0)
                    {
                        const voxelBlockHitbox = VoxelQueryUtil.getVoxelBlockBox(row, col, layer);
                        if (Geometry3DUtil.AABBsOverlap(hitbox, voxelBlockHitbox))
                            set.add({hitbox: voxelBlockHitbox, colliderConfig: voxelBlockColliderConfig});
                    }
                }
            }
        }

        // Object hitboxes (an object reaching into several physics voxels is met in each).
        for (const physicsVoxel of PhysicsVoxelUtil.getVoxelsInBox(physicsRoom, hitbox))
        {
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
        return set;
    },
    // Whether anything that blocks movement (voxel blocks, the room's boundary, solid objects) overlaps
    // the box.
    boxOverlapsHardCollider(physicsRoom: PhysicsRoom, box: AABB3): boolean
    {
        for (const overlap of PhysicsColliderStateUtil.findOverlappingColliderStates(physicsRoom, box))
        {
            if (overlap.colliderConfig.applyHardCollisionToOthers)
                return true;
        }
        return false;
    },
}

// Laid on its face (see Geometry3DUtil.getAxisFacingBasis). The box is slightly inset on the face's own
// axes (ATTACHMENT_HITBOX_INSET), so neighbours sharing an edge don't register as overlapping; depth is
// untouched so the object stays on its face.
function getAttachedHalfSize(size: Vec3, dir: Vec3): Vec3
{
    const {normal, right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
    const insetSizeX = Math.max(0, size.x - ATTACHMENT_HITBOX_INSET);
    const insetSizeY = Math.max(0, size.y - ATTACHMENT_HITBOX_INSET);
    const halfSizeAlong = (axis: "x" | "y" | "z") => 0.5 * (Math.abs(right[axis]) * insetSizeX
        + Math.abs(up[axis]) * insetSizeY + Math.abs(normal[axis]) * size.z);
    return {x: halfSizeAlong("x"), y: halfSizeAlong("y"), z: halfSizeAlong("z")};
}

// Upright: turning to face another horizontal axis swaps the box's horizontal dimensions.
function getFreeStandingHalfSize(size: Vec3, dir: Vec3): Vec3
{
    const moreAlignedWithXAxis = Math.abs(dir.x) > Math.abs(dir.z);
    return {
        x: 0.5 * (moreAlignedWithXAxis ? size.z : size.x),
        y: 0.5 * size.y,
        z: 0.5 * (moreAlignedWithXAxis ? size.x : size.z),
    };
}

export default PhysicsColliderStateUtil;