import AABB3 from "../math/types/aabb3";
import Vec3 from "../math/types/vec3";
import Vector3DUtil from "../math/util/vector3DUtil";
import Geometry3DUtil from "../math/util/geometry3DUtil";
import PhysicsObject from "./types/physicsObject";
import PhysicsColliderUpdateResult from "./types/physicsColliderUpdateResult";
import RoomRuntimeMemory from "../room/types/roomRuntimeMemory";
import PhysicsRoom from "./types/physicsRoom";
import PhysicsHitState from "./types/physicsHitState";
import PhysicsCollisionUtil from "./util/physicsCollisionUtil";
import PhysicsVoxelUtil from "./util/physicsVoxelUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, STEP_UP_HEIGHT } from "../system/sharedConstants";
import { ColliderState } from "./types/colliderState";

const physicsRooms: {[roomID: string]: PhysicsRoom} = {};

let hitStateTemp: PhysicsHitState = {
    minHitRayScale: 1,
    hitNormal: undefined,
};

const PhysicsManager =
{
    physicsRooms,
    load: (roomRuntimeMemory: RoomRuntimeMemory) =>
    {
        if (physicsRooms[roomRuntimeMemory.room.id] != undefined)
            throw new Error(`Physics-room already exists (roomID = ${roomRuntimeMemory.room.id})`);
        physicsRooms[roomRuntimeMemory.room.id] = new PhysicsRoom(roomRuntimeMemory.room);

        const objects = Object.values(roomRuntimeMemory.room.objectById);
        for (const obj of objects)
        {
            const colliderState = obj.getObjectColliderState();
            if (colliderState)
                PhysicsManager.addObject(roomRuntimeMemory.room.id, obj.objectId, obj.objectTypeIndex, colliderState);
        }
    },
    unload: (roomID: string) =>
    {
        if (physicsRooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);
        delete physicsRooms[roomID];
    },
    hasRoom: (roomID: string): boolean =>
    {
        return physicsRooms[roomID] != undefined;
    },
    hasObject: (roomID: string, objectId: string): boolean =>
    {
        const physicsRoom = physicsRooms[roomID];
        if (physicsRoom == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);

        return physicsRoom.objectById[objectId] != undefined;
    },
    addObject: (roomID: string, objectId: string, objectTypeIndex: number, colliderState: ColliderState): PhysicsObject =>
    {
        const physicsRoom = physicsRooms[roomID];
        if (physicsRoom == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);

        if (physicsRoom.objectById[objectId] != undefined) // already added
        {
            console.warn(`PhysicsObject is already added (roomID = ${roomID}, objectId = ${objectId})`);
            return physicsRoom.objectById[objectId];
        }
        const newObject = new PhysicsObject(physicsRoom, objectId, objectTypeIndex, colliderState);
        physicsRoom.objectById[objectId] = newObject;
        return newObject;
    },
    removeObject: (roomID: string, objectId: string) =>
    {
        const physicsRoom = physicsRooms[roomID];
        if (physicsRoom == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);

        const object = physicsRoom.objectById[objectId];
        if (object == undefined)
            throw new Error(`PhysicsObject is not registered (roomID = ${roomID}, objectId = ${objectId})`);
        delete physicsRoom.objectById[objectId];
        object.onDestroy();
    },
    /**
     * Attempts to move the object from its current position to `targetPos` while also
     * updating its hitbox orientation based on `targetDir`.
     * Handles 3D collision resolution, step-up logic, and gravity (via the caller's targetPos.y).
     *
     * targetPos.y and resolvedPos.y represent the object's base Y (foot position),
     * NOT the hitbox center. Internally, the engine converts to hitbox-center coordinates.
     */
    trySetTransform: (roomID: string, objectId: string, objectTypeIndex: number,
        targetPos: Vec3, targetDir: Vec3): PhysicsColliderUpdateResult =>
    {
        const physicsRoom = physicsRooms[roomID];
        if (physicsRoom == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

        const object = physicsRoom.objectById[objectId];
        if (object == undefined)
            throw new Error(`PhysicsObject is not registered (objectId = ${objectId})`);

        // Compute new hitbox dimensions based on direction
        const newColliderState = PhysicsCollisionUtil.getObjectColliderState(objectTypeIndex, targetPos, targetDir);
        if (!newColliderState)
            throw new Error(`ColliderState couldn't be computed (objectId = ${objectId}, objectTypeIndex = ${objectTypeIndex})`);

        const sourceHitbox = object.colliderState.hitbox;
        const halfSizeX = newColliderState.hitbox.halfSizeX;
        const halfSizeY = newColliderState.hitbox.halfSizeY;
        const halfSizeZ = newColliderState.hitbox.halfSizeZ;

        // Convert base Y to hitbox-center Y for internal processing
        const targetCenterY = targetPos.y + halfSizeY;

        // Start position is always the current hitbox center
        const startCenter: Vec3 = { x: sourceHitbox.x, y: sourceHitbox.y, z: sourceHitbox.z };
        const startBaseY = sourceHitbox.y - halfSizeY;

        // Any attempt to move more than 3 units will force-sync the object back to its original location.
        const desyncDistSqr =
            (targetPos.x - startCenter.x) * (targetPos.x - startCenter.x) +
            (targetPos.z - startCenter.z) * (targetPos.z - startCenter.z) +
            (targetCenterY - startCenter.y) * (targetCenterY - startCenter.y);
        if (desyncDistSqr >= 9)
        {
            console.warn(`Physics-position desync due to distance gap (dist = ${Math.sqrt(desyncDistSqr).toFixed(3)})`);
            return { resolvedPos: { x: startCenter.x, y: startBaseY, z: startCenter.z }, desyncDetected: true };
        }

        // ----- Phase 1: XZ Movement Resolution -----
        // Move horizontally at the current center Y, skipping steppable obstacles.

        const xzTarget: Vec3 = { x: targetPos.x, y: startCenter.y, z: targetPos.z };

        // Step back the starting position a bit to prevent raycasting from within obstacles.
        const xzDir = Vector3DUtil.normalize({ x: xzTarget.x - startCenter.x, y: 0, z: xzTarget.z - startCenter.z });
        const xzStart: Vec3 = {
            x: startCenter.x - xzDir.x * 0.01,
            y: startCenter.y,
            z: startCenter.z - xzDir.z * 0.01,
        };

        // Use new half-sizes for the source hitbox during raycasting
        const sourceAABB: AABB3 = {
            x: xzStart.x, y: xzStart.y, z: xzStart.z,
            halfSizeX, halfSizeY, halfSizeZ,
        };

        const minIntersectableX = Math.min(xzStart.x, xzTarget.x) - halfSizeX;
        const maxIntersectableX = Math.max(xzStart.x, xzTarget.x) + halfSizeX;
        const minIntersectableZ = Math.min(xzStart.z, xzTarget.z) - halfSizeZ;
        const maxIntersectableZ = Math.max(xzStart.z, xzTarget.z) + halfSizeZ;
        const minCol = Math.floor(minIntersectableX);
        const maxCol = Math.floor(maxIntersectableX);
        const minRow = Math.floor(minIntersectableZ);
        const maxRow = Math.floor(maxIntersectableZ);

        // Detect out-of-boundary conditions.
        if (minCol < 0 || minRow < 0 || maxCol >= NUM_VOXEL_COLS || maxRow >= NUM_VOXEL_ROWS)
        {
            console.warn(`Physics-position desync due to room boundary limit`);
            return { resolvedPos: { x: startCenter.x, y: startBaseY, z: startCenter.z }, desyncDetected: true };
        }

        object.removeFromIntersectingVoxels();

        hitStateTemp.minHitRayScale = 1;
        hitStateTemp.hitNormal = undefined;

        const objectBottomY = startCenter.y - halfSizeY;
        let maxStepUpTargetY = -Infinity; // Track highest steppable surface

        // Process collision against voxel blocks
        for (let row = minRow; row <= maxRow; ++row)
        {
            for (let col = minCol; col <= maxCol; ++col)
            {
                const physicsVoxel = physicsRoom.voxels[row * NUM_VOXEL_COLS + col];
                const voxelMask = physicsVoxel.voxel.collisionLayerMask;

                for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                {
                    if ((voxelMask & (1 << layer)) === 0)
                        continue; // Layer not occupied

                    // Compute voxel block AABB3
                    const blockCenterY = layer * 0.5 + 0.25;
                    const blockTopY = blockCenterY + 0.25;
                    const blockAABB: AABB3 = {
                        x: col + 0.5, y: blockCenterY, z: row + 0.5,
                        halfSizeX: 0.5, halfSizeY: 0.25, halfSizeZ: 0.5,
                    };

                    // Check if this block is steppable
                    if (blockTopY > objectBottomY && blockTopY <= objectBottomY + STEP_UP_HEIGHT)
                    {
                        // Steppable: record step-up target, skip XZ blocking
                        maxStepUpTargetY = Math.max(maxStepUpTargetY, blockTopY);
                        continue;
                    }

                    // Not steppable: include in collision resolution
                    PhysicsCollisionUtil.pushBoxAgainstBox(sourceAABB, xzTarget, blockAABB, hitStateTemp);
                }
            }
        }

        // Process collision against floor and ceiling
        PhysicsCollisionUtil.pushBoxAgainstBox(sourceAABB, xzTarget, physicsRoom.floorCollider, hitStateTemp);
        PhysicsCollisionUtil.pushBoxAgainstBox(sourceAABB, xzTarget, physicsRoom.ceilingCollider, hitStateTemp);

        // Process collision against other objects in nearby voxels
        const checkedObjectIds: {[id: string]: boolean} = {};
        for (let row = minRow; row <= maxRow; ++row)
        {
            for (let col = minCol; col <= maxCol; ++col)
            {
                const physicsVoxel = physicsRoom.voxels[row * NUM_VOXEL_COLS + col];
                for (const otherObject of physicsVoxel.intersectingObjects)
                {
                    if (otherObject.objectId == object.objectId || checkedObjectIds[otherObject.objectId])
                        continue;
                    checkedObjectIds[otherObject.objectId] = true;

                    const otherHitbox = otherObject.colliderState.hitbox;
                    if (halfSizeX > 0 || halfSizeZ > 0)
                    {
                        const otherTopY = otherHitbox.y + otherHitbox.halfSizeY;
                        if (otherTopY > objectBottomY && otherTopY <= objectBottomY + STEP_UP_HEIGHT)
                        {
                            maxStepUpTargetY = Math.max(maxStepUpTargetY, otherTopY);
                            continue;
                        }
                        PhysicsCollisionUtil.pushBoxAgainstBox(sourceAABB, xzTarget, otherHitbox, hitStateTemp);
                    }
                }
            }
        }

        // Resolve XZ with sliding
        let resolvedPos: Vec3 = xzTarget;

        if (hitStateTemp.hitNormal != undefined)
        {
            const startToHit = Vector3DUtil.scale(
                Vector3DUtil.subtract(xzTarget, xzStart), hitStateTemp.minHitRayScale);
            const hitPos: Vec3 = Vector3DUtil.add(xzStart, startToHit);
            const hitToTarget = Vector3DUtil.subtract(xzTarget, hitPos);
            const normal = hitStateTemp.hitNormal as Vec3;

            // Project remaining movement onto the hit surface (remove normal component)
            const dotNormal = Vector3DUtil.dot(hitToTarget, normal);
            const slidedOffset: Vec3 = {
                x: hitToTarget.x - normal.x * dotNormal,
                y: hitToTarget.y - normal.y * dotNormal,
                z: hitToTarget.z - normal.z * dotNormal,
            };
            const slidedHitPos: Vec3 = Vector3DUtil.add(hitPos, slidedOffset);

            // Check if the slide is blocked
            const slideCheckVoxels = PhysicsVoxelUtil.getVoxelsInBox(physicsRoom, {
                x: slidedHitPos.x, y: slidedHitPos.y, z: slidedHitPos.z,
                halfSizeX, halfSizeY, halfSizeZ,
            });
            let slideBlocked = false;
            for (const physicsVoxel of slideCheckVoxels)
            {
                const voxelMask = physicsVoxel.voxel.collisionLayerMask;
                for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                {
                    if ((voxelMask & (1 << layer)) === 0)
                        continue;
                    const blockTopY = layer * 0.5 + 0.5;
                    // Only consider non-steppable blocks for slide blocking
                    if (blockTopY > objectBottomY + STEP_UP_HEIGHT || blockTopY <= objectBottomY)
                    {
                        const blockAABB: AABB3 = {
                            x: physicsVoxel.voxel.col + 0.5,
                            y: layer * 0.5 + 0.25,
                            z: physicsVoxel.voxel.row + 0.5,
                            halfSizeX: 0.5, halfSizeY: 0.25, halfSizeZ: 0.5,
                        };
                        if (Geometry3DUtil.AABBsOverlap({
                            x: slidedHitPos.x, y: slidedHitPos.y, z: slidedHitPos.z,
                            halfSizeX, halfSizeY, halfSizeZ,
                        }, blockAABB))
                        {
                            slideBlocked = true;
                            break;
                        }
                    }
                }
                if (slideBlocked) break;
            }

            resolvedPos = slideBlocked ? hitPos : slidedHitPos;
        }

        // ----- Phase 2: Step-Up -----
        // If we recorded steppable surfaces and the resolved XZ position overlaps them, step up.
        let resolvedCenterY = startCenter.y;
        if (maxStepUpTargetY > objectBottomY)
        {
            // Verify the resolved XZ position actually overlaps a steppable surface
            const resolvedVoxels = PhysicsVoxelUtil.getVoxelsInBox(physicsRoom, {
                x: resolvedPos.x, y: resolvedPos.y, z: resolvedPos.z,
                halfSizeX, halfSizeY, halfSizeZ,
            });
            for (const physicsVoxel of resolvedVoxels)
            {
                const voxelMask = physicsVoxel.voxel.collisionLayerMask;
                for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                {
                    if ((voxelMask & (1 << layer)) === 0)
                        continue;
                    const blockTopY = layer * 0.5 + 0.5;
                    if (blockTopY > objectBottomY && blockTopY <= objectBottomY + STEP_UP_HEIGHT)
                    {
                        // Check XZ overlap
                        const blockMinX = physicsVoxel.voxel.col;
                        const blockMaxX = physicsVoxel.voxel.col + 1;
                        const blockMinZ = physicsVoxel.voxel.row;
                        const blockMaxZ = physicsVoxel.voxel.row + 1;
                        const objMinX = resolvedPos.x - halfSizeX;
                        const objMaxX = resolvedPos.x + halfSizeX;
                        const objMinZ = resolvedPos.z - halfSizeZ;
                        const objMaxZ = resolvedPos.z + halfSizeZ;
                        if (objMaxX > blockMinX && objMinX < blockMaxX &&
                            objMaxZ > blockMinZ && objMinZ < blockMaxZ)
                        {
                            resolvedCenterY = Math.max(resolvedCenterY, blockTopY + halfSizeY);
                        }
                    }
                }
            }
        }

        // ----- Phase 3: Gravity (vertical resolution) -----
        // The caller has set targetPos.y (base Y) to include gravity.
        // Cast downward from the step-up-resolved center to target center.
        if (targetCenterY < resolvedCenterY)
        {
            const gravitySource: AABB3 = {
                x: resolvedPos.x, y: resolvedCenterY, z: resolvedPos.z,
                halfSizeX, halfSizeY, halfSizeZ,
            };
            const gravityTarget: Vec3 = { x: resolvedPos.x, y: targetCenterY, z: resolvedPos.z };

            let gravityHitScale = 1;

            // Check floor
            const floorResult = Geometry3DUtil.castAABBAgainstAABB(gravitySource, gravityTarget, physicsRoom.floorCollider);
            if (floorResult.hitRayScale < gravityHitScale)
                gravityHitScale = floorResult.hitRayScale;

            // Check voxel blocks beneath
            const gravityVoxels = PhysicsVoxelUtil.getVoxelsInBox(physicsRoom, {
                x: resolvedPos.x, y: Math.min(resolvedCenterY, targetCenterY), z: resolvedPos.z,
                halfSizeX, halfSizeY: Math.abs(resolvedCenterY - targetCenterY) * 0.5 + halfSizeY, halfSizeZ,
            });
            for (const physicsVoxel of gravityVoxels)
            {
                const voxelMask = physicsVoxel.voxel.collisionLayerMask;
                for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                {
                    if ((voxelMask & (1 << layer)) === 0)
                        continue;
                    const blockAABB: AABB3 = {
                        x: physicsVoxel.voxel.col + 0.5,
                        y: layer * 0.5 + 0.25,
                        z: physicsVoxel.voxel.row + 0.5,
                        halfSizeX: 0.5, halfSizeY: 0.25, halfSizeZ: 0.5,
                    };
                    const result = Geometry3DUtil.castAABBAgainstAABB(gravitySource, gravityTarget, blockAABB);
                    if (result.hitRayScale < gravityHitScale)
                        gravityHitScale = result.hitRayScale;
                }
            }

            // Check other objects beneath
            for (const otherObject of Object.values(physicsRoom.objectById))
            {
                if (otherObject.objectId === object.objectId)
                    continue;
                const result = Geometry3DUtil.castAABBAgainstAABB(gravitySource, gravityTarget, otherObject.colliderState.hitbox);
                if (result.hitRayScale < gravityHitScale)
                    gravityHitScale = result.hitRayScale;
            }

            const gravityDrop = (resolvedCenterY - targetCenterY) * gravityHitScale;
            resolvedCenterY = resolvedCenterY - gravityDrop;
        }

        // ----- Finalize -----
        // Store hitbox center in the collider state
        object.colliderState.hitbox.x = resolvedPos.x;
        object.colliderState.hitbox.y = resolvedCenterY;
        object.colliderState.hitbox.z = resolvedPos.z;
        object.colliderState.hitbox.halfSizeX = halfSizeX;
        object.colliderState.hitbox.halfSizeY = halfSizeY;
        object.colliderState.hitbox.halfSizeZ = halfSizeZ;
        object.colliderState.colliderConfig = newColliderState.colliderConfig;

        object.addToIntersectingVoxels();

        // Return base Y (foot position) to the caller
        const resolvedBaseY = resolvedCenterY - halfSizeY;
        return { resolvedPos: { x: resolvedPos.x, y: resolvedBaseY, z: resolvedPos.z }, desyncDetected: false };
    },
    forceSetTransform: (roomID: string, objectId: string, objectTypeIndex: number,
        position: Vec3, direction: Vec3) =>
    {
        const physicsRoom = physicsRooms[roomID];
        if (physicsRooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

        const object = physicsRoom.objectById[objectId];
        if (object == undefined)
            throw new Error(`PhysicsObject is not registered (objectId = ${objectId})`);

        const colliderState = PhysicsCollisionUtil.getObjectColliderState(objectTypeIndex, position, direction);
        if (!colliderState)
            throw new Error(`ColliderState couldn't be computed (objectId = ${objectId}, objectTypeIndex = ${objectTypeIndex})`);

        object.removeFromIntersectingVoxels();
        object.colliderState = colliderState;
        object.addToIntersectingVoxels();
    },
}

export default PhysicsManager;