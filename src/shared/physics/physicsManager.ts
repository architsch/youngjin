import Vec2 from "../math/types/vec2";
import Vector2D from "../math/util/vector2D";
import PhysicsObject from "./types/physicsObject";
import PhysicsVoxel from "./types/physicsVoxel";
import PhysicsPosUpdateResult from "./types/physicsPosUpdateResult";
import RoomRuntimeMemory from "../room/types/roomRuntimeMemory";
import PhysicsRoom from "./types/physicsRoom";
import PhysicsHitState from "./types/physicsHitState";
import AABB2 from "../math/types/aabb2";
import { getLowestObjectCollisionLayer, getObjectsInDist, removeObjectFromIntersectingVoxels, setObjectPosition } from "./util/physicsObjectUtil";
import { getVoxelsInBox } from "./util/physicsVoxelUtil";
import { pushBoxAgainstBox } from "./util/physicsCollisionUtil";
import { getHighestOccupiedVoxelCollisionLayer, isVoxelCollisionLayerOccupied } from "../voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, MIN_OBJECT_LEVEL_CHANGE_INTERVAL, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../system/sharedConstants";

const physicsRooms: {[roomID: string]: PhysicsRoom} = {};

let hitStateTemp: PhysicsHitState = {
    minHitRayScale: 1,
    hitLine: undefined,
};

const PhysicsManager =
{
    load: (roomRuntimeMemory: RoomRuntimeMemory) =>
    {
        if (physicsRooms[roomRuntimeMemory.room.id] != undefined)
            throw new Error(`Physics-room already exists (roomID = ${roomRuntimeMemory.room.id})`);

        const voxelGrid = roomRuntimeMemory.room.voxelGrid;

        physicsRooms[roomRuntimeMemory.room.id] = {
            room: roomRuntimeMemory.room,
            voxels: voxelGrid.voxels.map(voxel => {
                const row = voxel.row;
                const col = voxel.col;
                const intersectingObjects = new Array<PhysicsObject>(4);
                intersectingObjects.length = 0;

                const physicsVoxel: PhysicsVoxel = {
                    voxel,
                    hitbox: {x: col+0.5, y: row+0.5, halfSizeX: 0.5, halfSizeY: 0.5},
                    intersectingObjects,
                };
                return physicsVoxel;
            }),
            objectById: {},
        };
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
    addObject: (roomID: string, objectId: string, posY: number, hitbox: AABB2, collisionLayerMaskAtGroundLevel: number): PhysicsObject =>
    {
        //console.log(`PhysicsManager.addObject :: roomID = ${roomID}, objectId = ${objectId}`);
        const physicsRoom = physicsRooms[roomID];
        if (physicsRoom == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);

        if (physicsRoom.objectById[objectId] != undefined) // already added
        {
            console.warn(`PhysicsObjct is already added (roomID = ${roomID}, objectId = ${objectId})`);
            return physicsRoom.objectById[objectId];
        }
        const intersectingVoxels = new Array<PhysicsVoxel>(4);
        intersectingVoxels.length = 0;

        const newObject: PhysicsObject = {
            objectId,
            collisionLayerMaskAtGroundLevel,
            level: Math.round(2 * posY),
            lastLevelChangeTime: performance.now() * 0.001,
            hitbox,
            intersectingVoxels
        };
        physicsRoom.objectById[objectId] = newObject;

        setObjectPosition(physicsRoom, objectId, { x: hitbox.x, y: hitbox.y });
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

        removeObjectFromIntersectingVoxels(object);
    },
    tryMoveObject: (roomID: string, objectId: string, targetPos: Vec2): PhysicsPosUpdateResult =>
    {
        const physicsRoom = physicsRooms[roomID];
        if (physicsRooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

        const object = physicsRoom.objectById[objectId];
        if (object == undefined)
            throw new Error(`PhysicsObject is not registered (objectId = ${objectId})`);

        let startPos: Vec2 = { x: object.hitbox.x, y: object.hitbox.y };

        // Any attempt to move more for than the distance of 3 will force-sync the object back to its original location.
        const desyncDistSqr = Vector2D.distSqr(targetPos, startPos);
        if (desyncDistSqr >= 9)
        {
            console.warn(`Physics-position desync due to distance gap (startPos = (${startPos.x.toFixed(3)}, ${startPos.y.toFixed(3)}), targetPos = (${targetPos.x.toFixed(3)}, ${targetPos.y.toFixed(3)}), dist = ${Math.sqrt(desyncDistSqr)})`);
            return { resolvedPos: startPos, desyncDetected: true };
        }

        // Step back the starting position a bit, to prevent raycasting from within the enclosing line segments of whichever nearby obstacle (hitbox) that the object is running against.
        const dir = Vector2D.normalize(Vector2D.subtract(targetPos, startPos));
        startPos = Vector2D.subtract(startPos, Vector2D.scale(dir, 0.01));

        const minIntersectableX = Math.min(startPos.x, targetPos.x) - object.hitbox.halfSizeX;
        const maxIntersectableX = Math.max(startPos.x, targetPos.x) + object.hitbox.halfSizeX;
        const minIntersectableY = Math.min(startPos.y, targetPos.y) - object.hitbox.halfSizeY;
        const maxIntersectableY = Math.max(startPos.y, targetPos.y) + object.hitbox.halfSizeY;
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

        hitStateTemp.minHitRayScale = 1;
        hitStateTemp.hitLine = undefined;
        
        const currTime = performance.now() * 0.001;
        const currVoxel = physicsRoom.voxels[Math.floor(startPos.y) * NUM_VOXEL_COLS + Math.floor(startPos.x)].voxel;
        let objectMask = object.collisionLayerMaskAtGroundLevel << object.level;
        const objectMaskAfterShift = object.collisionLayerMaskAtGroundLevel << (object.level + 1);
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
                        currTime >= object.lastLevelChangeTime + MIN_OBJECT_LEVEL_CHANGE_INTERVAL && // It's been long enough since the last time the object's level changed.
                        (objectMask & 0b10000000) == 0 && // Object is not touching the ceiling
                        (currVoxel.collisionLayerMask & objectMaskAfterShift) == 0 && // There is space for the object to jump within the current voxel
                        (targetVoxel.collisionLayerMask & objectMaskAfterShift) == 0; // There is space for the object to occupy after the jump (in the target voxel)

                    if (canJumpOverToTargetVoxel)
                    {
                        object.level++;
                        objectMask = object.collisionLayerMaskAtGroundLevel << object.level;
                        object.lastLevelChangeTime = currTime;
                    }
                    else
                    {
                        pushBoxAgainstBox(object.hitbox, targetPos, physicsVoxel.hitbox, hitStateTemp);
                    }
                }

                const highestLayer = getHighestOccupiedVoxelCollisionLayer(targetVoxel);
                if (highestLayer != COLLISION_LAYER_NULL && highestLayer > maxLayerAmongOverlappingVoxels)
                    maxLayerAmongOverlappingVoxels = highestLayer;
            }
        }

        // Object should fall down if it is suspended in thin air
        if (object.level > 0 &&
            currTime >= object.lastLevelChangeTime + MIN_OBJECT_LEVEL_CHANGE_INTERVAL &&
            getLowestObjectCollisionLayer(object) > maxLayerAmongOverlappingVoxels+1)
        {
            object.level--;
            objectMask = object.collisionLayerMaskAtGroundLevel << object.level;
            object.lastLevelChangeTime = currTime;
        }
        
        // Process collision against other objects
        for (const otherObject of Object.values(physicsRoom.objectById))
        {
            const otherObjectMask = otherObject.collisionLayerMaskAtGroundLevel << otherObject.level;

            if (object.objectId != otherObject.objectId &&
                (object.hitbox.halfSizeX > 0 || object.hitbox.halfSizeY > 0) &&
                (objectMask & otherObjectMask) != 0)
            {
                hitStateTemp = pushBoxAgainstBox(object.hitbox, targetPos, otherObject.hitbox, hitStateTemp);
            }
        }

        let resolvedPos = targetPos;

        if (hitStateTemp.hitLine != undefined)
        {   
            const startToHit = Vector2D.scale(Vector2D.subtract(targetPos, startPos), hitStateTemp.minHitRayScale);
            const hitPos: Vec2 = Vector2D.add(startPos, startToHit);
            const hitToTarget = Vector2D.subtract(targetPos, hitPos);
            let hitTangent = Vector2D.subtract(hitStateTemp.hitLine.end, hitStateTemp.hitLine.start);
            let dot = Vector2D.dot(hitToTarget, hitTangent);
            if (dot < 0)
            {
                // Angle between 'hitToTarget' and 'hitTangent' must be acute
                hitTangent = Vector2D.subtract(hitStateTemp.hitLine.start, hitStateTemp.hitLine.end);
                dot = Vector2D.dot(hitToTarget, hitTangent);
            }
            const projectedHitToTarget = Vector2D.scale(hitTangent, dot / Vector2D.dot(hitTangent, hitTangent));
            const slidedHitPos = Vector2D.add(hitPos, projectedHitToTarget);

            const voxelsHitOnSlide = getVoxelsInBox(physicsRoom, {
                x: slidedHitPos.x,
                y: slidedHitPos.y,
                halfSizeX: object.hitbox.halfSizeX,
                halfSizeY: object.hitbox.halfSizeY,
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
        
        object.hitbox.x = resolvedPos.x;
        object.hitbox.y = resolvedPos.y;

        return { resolvedPos, desyncDetected: false };
    },
    forceMoveObject: (roomID: string, objectId: string, targetPos: Vec2) =>
    {
        const physicsRoom = physicsRooms[roomID];
        if (physicsRooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

        const object = physicsRoom.objectById[objectId];
        if (object == undefined)
            throw new Error(`PhysicsObject is not registered (objectId = ${objectId})`);

        object.hitbox.x = targetPos.x;
        object.hitbox.y = targetPos.y;
    },
    getObjectsInDist: (roomID: string, centerX: number, centerY: number, dist: number): PhysicsObject[] =>
    {
        const physicsRoom = physicsRooms[roomID];
        if (physicsRooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

        return getObjectsInDist(physicsRoom, centerX, centerY, dist);
    },
}

export default PhysicsManager;