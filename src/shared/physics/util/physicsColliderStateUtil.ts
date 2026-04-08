import AABB3 from "../../math/types/aabb3";
import Vec3 from "../../math/types/vec3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import { ColliderState } from "../types/colliderState";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import { ColliderConfig } from "../types/colliderConfig";
import PhysicsDebugUtil from "./physicsDebugUtil";
import PhysicsRoom from "../types/physicsRoom";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, VOXEL_BLOCK_HITBOX_HALFSIZE } from "../../system/sharedConstants";

const colliderStatesTemp: Set<ColliderState> = new Set<ColliderState>();

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
        const moreAlignedWithXAxis = Math.abs(direction.x) > Math.abs(direction.z);
        const reorientedSizeX = moreAlignedWithXAxis ? hitboxSize.sizeZ : hitboxSize.sizeX;
        const reorientedSizeZ = moreAlignedWithXAxis ? hitboxSize.sizeX : hitboxSize.sizeZ;
        const hitbox: AABB3 = {
            center: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            halfSize: {
                x: 0.5 * reorientedSizeX,
                y: 0.5 * hitboxSize.sizeY,
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
        const minCol = Math.floor(minX);
        const maxCol = Math.floor(maxX);
        const minRow = Math.floor(minZ);
        const maxRow = Math.floor(maxZ);

        colliderStatesTemp.clear();
        if (Geometry3DUtil.AABBsOverlap(hitbox, physicsRoom.floor.hitbox))
            colliderStatesTemp.add(physicsRoom.floor);
        if (Geometry3DUtil.AABBsOverlap(hitbox, physicsRoom.ceiling.hitbox))
            colliderStatesTemp.add(physicsRoom.ceiling);

        if (minCol < 0 || minRow < 0 || maxCol >= NUM_VOXEL_COLS || maxRow >= NUM_VOXEL_ROWS)
            return colliderStatesTemp;

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
                            colliderStatesTemp.add({hitbox: voxelBlockHitbox, colliderConfig: voxelBlockColliderConfig});
                    }
                }
                // Object hitboxes
                for (const object of physicsVoxel.intersectingObjects)
                {
                    const objectHitbox = object.colliderState.hitbox;
                    if (objectHitbox != hitbox &&
                        !colliderStatesTemp.has(object.colliderState) &&
                        Geometry3DUtil.AABBsOverlap(hitbox, objectHitbox))
                    {
                        colliderStatesTemp.add(object.colliderState);
                    }
                }
            }
        }
        return colliderStatesTemp;
    }
}

export default PhysicsColliderStateUtil;