import Vec2 from "../math/types/vec2";
import Vector2D from "../math/util/vector2D";
import PhysicsObject from "./types/physicsObject";
import PhysicsVoxel from "./types/physicsVoxel";
import PhysicsPosUpdateResult from "./types/physicsPosUpdateResult";
import RoomRuntimeMemory from "../room/types/roomRuntimeMemory";
import PhysicsRoom from "./types/physicsRoom";
import PhysicsHitState from "./types/physicsHitState";
import AABB2 from "../math/types/aabb2";
import { getObjectsInDist, removeObjectFromIntersectingVoxels, setObjectPosition } from "./util/physicsObjectUtil";
import { getVoxelCollisionLayer, getVoxelsInBox } from "./util/physicsVoxelUtil";
import { pushBoxAgainstBox } from "./util/physicsCollisionUtil";

const rooms: {[roomID: string]: PhysicsRoom} = {};

let hitStateTemp: PhysicsHitState = {
    minHitRayScale: 1,
    hitLine: undefined,
};

const PhysicsManager =
{
    load: (roomRuntimeMemory: RoomRuntimeMemory) =>
    {
        if (rooms[roomRuntimeMemory.room.roomID] != undefined)
            throw new Error(`Physics-room already exists (roomID = ${roomRuntimeMemory.room.roomID})`);

        const voxelGrid = roomRuntimeMemory.room.voxelGrid;

        rooms[roomRuntimeMemory.room.roomID] = {
            roomID: roomRuntimeMemory.room.roomID,
            numGridRows: voxelGrid.numGridRows,
            numGridCols: voxelGrid.numGridCols,
            voxels: voxelGrid.voxels.map(voxel => {
                const row = voxel.row;
                const col = voxel.col;
                const intersectingObjects = new Array<PhysicsObject>(4);
                intersectingObjects.length = 0;

                const physicsVoxel: PhysicsVoxel = {
                    row, col,
                    collisionLayerMask: voxel.collisionLayerMask,
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
        if (rooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);
        delete rooms[roomID];
    },
    hasRoom: (roomID: string): boolean =>
    {
        return rooms[roomID] != undefined;
    },
    addObject: (roomID: string, objectId: string, hitbox: AABB2, collisionLayer: number) =>
    {
        //console.log(`PhysicsManager.addObject :: roomID = ${roomID}, objectId = ${objectId}`);
        const room = rooms[roomID];
        if (room == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);

        if (room.objectById[objectId] != undefined) // already added
        {
            console.warn(`PhysicsObjct is already added (roomID = ${roomID}, objectId = ${objectId})`);
            return;
        }
        const intersectingVoxels = new Array<PhysicsVoxel>(4);
        intersectingVoxels.length = 0;
        const newObject: PhysicsObject = { objectId, collisionLayer, hitbox: hitbox, intersectingVoxels };
        room.objectById[objectId] = newObject;

        setObjectPosition(room, objectId, { x: hitbox.x, y: hitbox.y });
    },
    removeObject: (roomID: string, objectId: string) =>
    {
        //console.log(`PhysicsManager.removeObject :: roomID = ${roomID}, objectId = ${objectId}`);
        const room = rooms[roomID];
        if (room == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID}, objectId = ${objectId})`);

        const object = room.objectById[objectId];
        if (object == undefined)
            throw new Error(`PhysicsObject is not registered (roomID = ${roomID}, objectId = ${objectId})`);
        delete room.objectById[objectId];

        removeObjectFromIntersectingVoxels(object);
    },
    tryMoveObject: (roomID: string, objectId: string, targetPos: Vec2): PhysicsPosUpdateResult =>
    {
        const room = rooms[roomID];
        if (rooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

        const object = room.objectById[objectId];
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
        if (desyncDistSqr < 0.000001)
        {
            return { resolvedPos: startPos, desyncDetected: false };
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
        if (minCol < 0 || minRow < 0 || maxCol >= room.numGridCols || maxRow >= room.numGridRows)
        {
            console.warn(`Physics-position desync due to room boundary limit (startPos = (${startPos.x.toFixed(3)}, ${startPos.y.toFixed(3)}), targetPos = (${targetPos.x.toFixed(3)}, ${targetPos.y.toFixed(3)}, minCol = ${minCol}, minRow = ${minRow}, maxCol = ${maxCol}, maxRow = ${maxRow}))`);
            return { resolvedPos: startPos, desyncDetected: true };
        }

        hitStateTemp.minHitRayScale = 1;
        hitStateTemp.hitLine = undefined;

        // Process collision against voxels
        for (let row = minRow; row <= maxRow; ++row)
        {
            for (let col = minCol; col <= maxCol; ++col)
            {
                const voxel = room.voxels[row * room.numGridCols + col];
                if (getVoxelCollisionLayer(room, row, col, object.collisionLayer) != 0)
                    pushBoxAgainstBox(object.hitbox, targetPos, voxel.hitbox, hitStateTemp);
            }
        }
        
        // Process collision against other objects
        for (const otherObject of Object.values(room.objectById))
        {
            if (object.objectId != otherObject.objectId &&
                (object.hitbox.halfSizeX > 0 || object.hitbox.halfSizeY > 0) &&
                object.collisionLayer == otherObject.collisionLayer)
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

            const voxelsHitOnSlide = getVoxelsInBox(room, {
                x: slidedHitPos.x,
                y: slidedHitPos.y,
                halfSizeX: object.hitbox.halfSizeX,
                halfSizeY: object.hitbox.halfSizeY,
            });
            let slideBlocked = false;
            for (const voxel of voxelsHitOnSlide)
            {
                if (getVoxelCollisionLayer(room, voxel.row, voxel.col, object.collisionLayer) != 0)
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
        const room = rooms[roomID];
        if (rooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

        const object = room.objectById[objectId];
        if (object == undefined)
            throw new Error(`PhysicsObject is not registered (objectId = ${objectId})`);

        object.hitbox.x = targetPos.x;
        object.hitbox.y = targetPos.y;
    },
    getObjectsInDist: (roomID: string, centerX: number, centerY: number, dist: number): PhysicsObject[] =>
    {
        const room = rooms[roomID];
        if (rooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

        return getObjectsInDist(room, centerX, centerY, dist);
    },
}

export default PhysicsManager;