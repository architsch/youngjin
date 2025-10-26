import Circle2 from "../math/types/circle2";
import Vec2 from "../math/types/vec2";
import Geometry2D from "../math/util/geometry2D";
import Vector2D from "../math/util/vector2D";
import PhysicsObject from "./physicsObject";
import PhysicsVoxel from "./physicsVoxel";
import PhysicsPosUpdateResult from "./physicsPosUpdateResult";
import RoomServerRecord from "../room/roomServerRecord";
import PhysicsRoom from "./physicsRoom";
import PhysicsHitState from "./physicsHitState";
import VoxelGrid from "../voxel/voxelGrid";
import AABB2 from "../math/types/aabb2";

const rooms: {[roomID: string]: PhysicsRoom} = {};

const voxelsTemp = new Array<PhysicsVoxel>();

let hitStateTemp: PhysicsHitState = {
    minHitRayScale: 1,
    hitLine: undefined,
};

const PhysicsManager =
{
    loadRoom: async (roomServerRecord: RoomServerRecord, voxelGrid: VoxelGrid) =>
    {
        if (rooms[roomServerRecord.room.roomID] != undefined)
            throw new Error(`Physics-room already exists (roomID = ${roomServerRecord.room.roomID})`);

        const objectById: { [objectId: string]: PhysicsObject } = {};
        for (const objectServerRecord of Object.values(roomServerRecord.objectServerRecords))
        {
            const spawnParams = objectServerRecord.objectSpawnParams;
            const collisionShape: Circle2 = {
                x: spawnParams.transform.x,
                y: spawnParams.transform.z,
                radius: 0.3,
            };
            const intersectingVoxels = new Array<PhysicsVoxel>(4);
            intersectingVoxels.length = 0;

            objectById[spawnParams.objectId] = {
                objectId: spawnParams.objectId,
                collisionLayer: 0,
                collisionShape,
                intersectingVoxels,
            };
        }

        rooms[roomServerRecord.room.roomID] = {
            numGridRows: voxelGrid.numGridRows,
            numGridCols: voxelGrid.numGridCols,
            voxels: voxelGrid.voxels.map(voxel => {
                const row = voxel.row;
                const col = voxel.col;
                const collisionShape = { x1: col, y1: row, x2: col+1, y2: row+1 };
                const intersectingObjects = new Array<PhysicsObject>(4);
                intersectingObjects.length = 0;

                const physicsVoxel: PhysicsVoxel = {
                    row, col,
                    collisionLayerMask: voxel.collisionLayerMask,
                    collisionShape,
                    intersectingObjects,
                };
                return physicsVoxel;
            }),
            objectById
        };
    },
    unloadRoom: async (roomID: string) =>
    {
        if (rooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);
        delete rooms[roomID];
    },
    hasRoom: (roomID: string): boolean =>
    {
        return rooms[roomID] != undefined;
    },
    addObject: (roomID: string, objectId: string, collisionShape: Circle2, collisionLayer: number) =>
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
        const newObject: PhysicsObject = { objectId, collisionLayer, collisionShape, intersectingVoxels };
        room.objectById[objectId] = newObject;

        setObjectPosition(roomID, objectId, { x: collisionShape.x, y: collisionShape.y });
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

        let startPos: Vec2 = { x: object.collisionShape.x, y: object.collisionShape.y };

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

        const radius = object.collisionShape.radius;
        const minIntersectableX = Math.min(startPos.x, targetPos.x) - radius;
        const maxIntersectableX = Math.max(startPos.x, targetPos.x) + radius;
        const minIntersectableY = Math.min(startPos.y, targetPos.y) - radius;
        const maxIntersectableY = Math.max(startPos.y, targetPos.y) + radius;
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

        for (let row = minRow; row <= maxRow; ++row)
        {
            for (let col = minCol; col <= maxCol; ++col)
            {
                const voxel = room.voxels[row * room.numGridCols + col];
                if (getVoxelCollisionLayer(roomID, row, col, object.collisionLayer) != 0)
                    hitStateTemp = pushCircleAgainstBox(object.collisionShape, targetPos, voxel.collisionShape, hitStateTemp);
            }
        }
        // TODO: Also process collision with other objects (circles).
        // ...

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

            const voxelsHitOnSlide = getVoxelsInCircle(roomID, {
                x: slidedHitPos.x,
                y: slidedHitPos.y,
                radius: object.collisionShape.radius,
            });
            let slideBlocked = false;
            for (const voxel of voxelsHitOnSlide)
            {
                if (getVoxelCollisionLayer(roomID, voxel.row, voxel.col, object.collisionLayer) != 0)
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
        
        object.collisionShape.x = resolvedPos.x;
        object.collisionShape.y = resolvedPos.y;
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

        object.collisionShape.x = targetPos.x;
        object.collisionShape.y = targetPos.y;
    },
}

function pushCircleAgainstBox(circle: Circle2, targetPos: Vec2, box: AABB2, hitState: PhysicsHitState): PhysicsHitState
{
    const result = Geometry2D.circlecastToAABB(circle, targetPos, box);
    if (result.hitRayScale <= hitState.minHitRayScale)
    {
        hitState.minHitRayScale = result.hitRayScale;
        hitState.hitLine = result.hitLine;
    }
    return hitState;
}

function addObjectToVoxel(object: PhysicsObject, voxel: PhysicsVoxel)
{
    let alreadyAdded = false;
    for (let i = 0; i < voxel.intersectingObjects.length; ++i)
    {
        const obj = voxel.intersectingObjects[i];
        if (obj.objectId == object.objectId)
        {
            console.error(`Object already added to voxel (object = ${JSON.stringify(object)}, voxel = ${JSON.stringify(voxel)})`);
            alreadyAdded = true;
        }
    }
    if (!alreadyAdded)
        voxel.intersectingObjects.push(object);

    alreadyAdded = false;
    for (let i = 0; i < object.intersectingVoxels.length; ++i)
    {
        const vox = object.intersectingVoxels[i];
        if (vox == voxel)
        {
            console.error(`Voxel already added to object (object = ${JSON.stringify(object)}, voxel = ${JSON.stringify(voxel)})`);
            alreadyAdded = true;
        }
    }
    if (!alreadyAdded)
        object.intersectingVoxels.push(voxel);
};

function setObjectPosition(roomID: string, objectId: string, pos: Vec2)
{
    const room = rooms[roomID];
    if (rooms[roomID] == undefined)
        throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

    const object = room.objectById[objectId];
    if (object == undefined)
        throw new Error(`PhysicsObject is not registered (objectId = ${objectId})`);

    const voxels = getVoxelsInCircle(roomID, object.collisionShape);
    object.collisionShape.x = pos.x;
    object.collisionShape.y = pos.y;

    removeObjectFromIntersectingVoxels(object);
    for (const voxel of voxels)
        addObjectToVoxel(object, voxel);
}

function removeObjectFromIntersectingVoxels(object: PhysicsObject)
{
    voxelsTemp.length = 0;
    for (const voxel of object.intersectingVoxels)
        voxelsTemp.push(voxel);
    for (const voxel of voxelsTemp)
        removeObjectFromVoxel(object, voxel);
}

function removeObjectFromVoxel(object: PhysicsObject, voxel: PhysicsVoxel)
{
    let removed = false;
    const objs = voxel.intersectingObjects;
    for (let i = 0; i < objs.length; ++i)
    {
        const obj = objs[i];
        if (obj.objectId == object.objectId)
        {
            for (let j = i+1; j < objs.length; ++j)
                objs[i] = objs[j];
            --objs.length;
            removed = true;
        }
    }
    if (!removed)
        console.error(`Object not found in voxel (object = ${JSON.stringify(object)}, voxel = ${JSON.stringify(voxel)})`);
}

function getVoxelsInCircle(roomID: string, circle: Circle2): PhysicsVoxel[]
{
    const room = rooms[roomID];
    if (rooms[roomID] == undefined)
        throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

    voxelsTemp.length = 0;
    const row1 = Math.floor(circle.y - circle.radius);
    const col1 = Math.floor(circle.x - circle.radius);
    const row2 = Math.floor(circle.y + circle.radius);
    const col2 = Math.floor(circle.x + circle.radius);
    for (let row = row1; row <= row2; ++row)
    {
        for (let col = col1; col <= col2; ++col)
        {
            voxelsTemp.push(room.voxels[row * room.numGridCols + col]);
        }
    }
    return voxelsTemp;
}

function addVoxelCollisionLayer(roomID: string, row: number, col: number, collisionLayer: number)
{
    const room = rooms[roomID];
    if (rooms[roomID] == undefined)
        throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

    room.voxels[row * room.numGridCols + col].collisionLayerMask |= (1 << collisionLayer);
}

function removeVoxelCollisionLayer(roomID: string, row: number, col: number, collisionLayer: number)
{
    const room = rooms[roomID];
    if (rooms[roomID] == undefined)
        throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

    room.voxels[row * room.numGridCols + col].collisionLayerMask &= ~(1 << collisionLayer);
}

// Returns 1 if the layer exists, or 0 otherwise.
function getVoxelCollisionLayer(roomID: string, row: number, col: number, collisionLayer: number): number
{
    const room = rooms[roomID];
    if (rooms[roomID] == undefined)
        throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

    return (room.voxels[row * room.numGridCols + col].collisionLayerMask >> collisionLayer) & 1;
}

export default PhysicsManager;