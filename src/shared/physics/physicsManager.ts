import Vec2 from "../math/types/vec2";
import Vector2DUtil from "../math/util/vector2DUtil";
import PhysicsObject from "./types/physicsObject";
import PhysicsPosUpdateResult from "./types/physicsPosUpdateResult";
import RoomRuntimeMemory from "../room/types/roomRuntimeMemory";
import PhysicsRoom from "./types/physicsRoom";
import PhysicsHitState from "./types/physicsHitState";
import PhysicsCollisionUtil from "./util/physicsCollisionUtil";
import PhysicsVoxelUtil from "./util/physicsVoxelUtil";
import VoxelQueryUtil from "../voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_NULL, MIN_OBJECT_LEVEL_CHANGE_TIME_INTERVAL, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../system/sharedConstants";
import { ColliderState } from "./types/colliderState";
import Vec3 from "../math/types/vec3";

const physicsRooms: {[roomID: string]: PhysicsRoom} = {};

let hitStateTemp: PhysicsHitState = {
    minHitRayScale: 1,
    hitLine: undefined,
};

const PhysicsManager =
{
    physicsRooms,
    load: (roomRuntimeMemory: RoomRuntimeMemory) =>
    {
        if (physicsRooms[roomRuntimeMemory.room.id] != undefined)
            throw new Error(`Physics-room already exists (roomID = ${roomRuntimeMemory.room.id})`);
        physicsRooms[roomRuntimeMemory.room.id] = new PhysicsRoom(roomRuntimeMemory.room);

        const persistentObjects = Object.values(roomRuntimeMemory.room.persistentObjectGroup.persistentObjectById);
        for (const po of persistentObjects)
        {
            const colliderState = po.getObjectColliderState();
            if (colliderState)
                PhysicsManager.addObject(roomRuntimeMemory.room.id, po.objectId, po.objectTypeIndex, colliderState);
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
            console.warn(`PhysicsObjct is already added (roomID = ${roomID}, objectId = ${objectId})`);
            return physicsRoom.objectById[objectId];
        }
        const newObject = new PhysicsObject(physicsRoom, objectId, objectTypeIndex, colliderState);
        physicsRoom.objectById[objectId] = newObject;
        return newObject;
    },
    removeObject: (roomID: string, objectId: string) =>
    {
        //console.log(`PhysicsManager.removeObject :: roomID = ${roomID}, objectId = ${objectId}`);
        const physicsRoom = physicsRooms[roomID];
        if (physicsRoom == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);

        const object = physicsRoom.objectById[objectId];
        if (object == undefined)
            throw new Error(`PhysicsObject is not registered (roomID = ${roomID}, objectId = ${objectId})`);
        delete physicsRoom.objectById[objectId];
        object.onDestroy();
    },
    tryMoveObject: (roomID: string, objectId: string, targetPos: Vec2): PhysicsPosUpdateResult =>
    {
        const physicsRoom = physicsRooms[roomID];
        if (physicsRooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

        const object = physicsRoom.objectById[objectId];
        if (object == undefined)
            throw new Error(`PhysicsObject is not registered (objectId = ${objectId})`);

        let startPos: Vec2 = { x: object.colliderState.hitbox.x, y: object.colliderState.hitbox.y };

        // Any attempt to move more for than the distance of 3 will force-sync the object back to its original location.
        const desyncDistSqr = Vector2DUtil.distSqr(targetPos, startPos);
        if (desyncDistSqr >= 9)
        {
            console.warn(`Physics-position desync due to distance gap (startPos = (${startPos.x.toFixed(3)}, ${startPos.y.toFixed(3)}), targetPos = (${targetPos.x.toFixed(3)}, ${targetPos.y.toFixed(3)}), dist = ${Math.sqrt(desyncDistSqr)})`);
            return { resolvedPos: startPos, desyncDetected: true };
        }

        // Step back the starting position a bit, to prevent raycasting from within the enclosing line segments of whichever nearby obstacle (hitbox) that the object is running against.
        const dir = Vector2DUtil.normalize(Vector2DUtil.subtract(targetPos, startPos));
        startPos = Vector2DUtil.subtract(startPos, Vector2DUtil.scale(dir, 0.01));

        const minIntersectableX = Math.min(startPos.x, targetPos.x) - object.colliderState.hitbox.halfSizeX;
        const maxIntersectableX = Math.max(startPos.x, targetPos.x) + object.colliderState.hitbox.halfSizeX;
        const minIntersectableY = Math.min(startPos.y, targetPos.y) - object.colliderState.hitbox.halfSizeY;
        const maxIntersectableY = Math.max(startPos.y, targetPos.y) + object.colliderState.hitbox.halfSizeY;
        const minCol = Math.floor(minIntersectableX);
        const maxCol = Math.floor(maxIntersectableX);
        const minRow = Math.floor(minIntersectableY);
        const maxRow = Math.floor(maxIntersectableY);

        // Detect the out-of-boundary conditions.
        if (minCol < 0 || minRow < 0 || maxCol >= NUM_VOXEL_COLS || maxRow >= NUM_VOXEL_ROWS)
        {
            console.warn(`Physics-position desync due to room boundary limit (startPos = (${startPos.x.toFixed(3)}, ${startPos.y.toFixed(3)}), targetPos = (${targetPos.x.toFixed(3)}, ${targetPos.y.toFixed(3)}, minCol = ${minCol}, minRow = ${minRow}, maxCol = ${maxCol}, maxRow = ${maxRow}))`);
            return { resolvedPos: startPos, desyncDetected: true };
        }

        object.removeFromIntersectingVoxels();

        hitStateTemp.minHitRayScale = 1;
        hitStateTemp.hitLine = undefined;
        
        const currTime = performance.now() * 0.001;
        const currVoxel = physicsRoom.voxels[Math.floor(startPos.y) * NUM_VOXEL_COLS + Math.floor(startPos.x)].voxel;
        let objectMask = object.colliderState.collisionLayerMask;
        const objectMaskAfterShift = objectMask << 1;
        let maxLayerAmongOverlappingVoxels = -9999;

        // Process collision against voxels
        for (let row = minRow; row <= maxRow; ++row)
        {
            for (let col = minCol; col <= maxCol; ++col)
            {
                const physicsVoxel = physicsRoom.voxels[row * NUM_VOXEL_COLS + col];
                const targetVoxel = physicsVoxel.voxel;

                if ((targetVoxel.collisionLayerMask & objectMask) != 0)
                {
                    const canJumpOverToTargetVoxel =
                        currTime >= object.lastLevelChangeTime + MIN_OBJECT_LEVEL_CHANGE_TIME_INTERVAL && // It's been long enough since the last time the object's level changed.
                        (objectMask & 0b10000000) == 0 && // Object is not touching the ceiling
                        (currVoxel.collisionLayerMask & objectMaskAfterShift) == 0 && // There is space for the object to jump within the current voxel
                        (targetVoxel.collisionLayerMask & objectMaskAfterShift) == 0; // There is space for the object to occupy after the jump (in the target voxel)

                    if (canJumpOverToTargetVoxel)
                    {
                        object.colliderState.level++;
                        objectMask = object.colliderState.collisionLayerMask;
                        object.lastLevelChangeTime = currTime;
                    }
                    else
                    {
                        PhysicsCollisionUtil.pushBoxAgainstBox(object.colliderState.hitbox, targetPos, physicsVoxel.hitbox, hitStateTemp);
                    }
                }

                const highestLayer = VoxelQueryUtil.getHighestOccupiedVoxelCollisionLayer(targetVoxel);
                if (highestLayer != COLLISION_LAYER_NULL && highestLayer > maxLayerAmongOverlappingVoxels)
                    maxLayerAmongOverlappingVoxels = highestLayer;
            }
        }

        // Object should fall down if it is suspended in thin air
        if (object.colliderState.level > 0 &&
            currTime >= object.lastLevelChangeTime + MIN_OBJECT_LEVEL_CHANGE_TIME_INTERVAL &&
            object.getLowestCollisionLayer() > maxLayerAmongOverlappingVoxels+1)
        {
            object.colliderState.level--;
            objectMask = object.colliderState.collisionLayerMask;
            object.lastLevelChangeTime = currTime;
        }
        
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

                    const otherObjectMask = otherObject.colliderState.collisionLayerMask;
                    if ((object.colliderState.hitbox.halfSizeX > 0 || object.colliderState.hitbox.halfSizeY > 0) &&
                        (objectMask & otherObjectMask) != 0)
                    {
                        hitStateTemp = PhysicsCollisionUtil.pushBoxAgainstBox(object.colliderState.hitbox, targetPos, otherObject.colliderState.hitbox, hitStateTemp);
                    }
                }
            }
        }

        let resolvedPos = targetPos;

        if (hitStateTemp.hitLine != undefined)
        {   
            const startToHit = Vector2DUtil.scale(Vector2DUtil.subtract(targetPos, startPos), hitStateTemp.minHitRayScale);
            const hitPos: Vec2 = Vector2DUtil.add(startPos, startToHit);
            const hitToTarget = Vector2DUtil.subtract(targetPos, hitPos);
            let hitTangent = Vector2DUtil.subtract(hitStateTemp.hitLine.end, hitStateTemp.hitLine.start);
            let dot = Vector2DUtil.dot(hitToTarget, hitTangent);
            if (dot < 0)
            {
                // Angle between 'hitToTarget' and 'hitTangent' must be acute
                hitTangent = Vector2DUtil.subtract(hitStateTemp.hitLine.start, hitStateTemp.hitLine.end);
                dot = Vector2DUtil.dot(hitToTarget, hitTangent);
            }
            const projectedHitToTarget = Vector2DUtil.scale(hitTangent, dot / Vector2DUtil.dot(hitTangent, hitTangent));
            const slidedHitPos = Vector2DUtil.add(hitPos, projectedHitToTarget);

            const voxelsHitOnSlide = PhysicsVoxelUtil.getVoxelsInBox(physicsRoom, {
                x: slidedHitPos.x,
                y: slidedHitPos.y,
                halfSizeX: object.colliderState.hitbox.halfSizeX,
                halfSizeY: object.colliderState.hitbox.halfSizeY,
            });
            let slideBlocked = false;
            for (const physicsVoxel of voxelsHitOnSlide)
            {
                if ((physicsVoxel.voxel.collisionLayerMask & objectMask) != 0)
                    slideBlocked = true;
            }
            if (slideBlocked)
            {
                //console.log(`hit - SLIDE BLOCKED (minHitRayScale = ${minHitRayScale}, hitPos = (${hitPos.x.toFixed(2)}, ${hitPos.y.toFixed(2)}), slidedHitPos = (${slidedHitPos.x.toFixed(2)}, ${slidedHitPos.y.toFixed(2)}))`);
                resolvedPos = hitPos;
            }
            else
            {
                //console.log(`hit (minHitRayScale = ${minHitRayScale}, hitPos = (${hitPos.x.toFixed(2)}, ${hitPos.y.toFixed(2)}), slidedHitPos = (${slidedHitPos.x.toFixed(2)}, ${slidedHitPos.y.toFixed(2)}))`);
                resolvedPos = slidedHitPos;
            }
        }
        
        object.colliderState.hitbox.x = resolvedPos.x;
        object.colliderState.hitbox.y = resolvedPos.y;

        object.addToIntersectingVoxels();

        return { resolvedPos, desyncDetected: false };
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