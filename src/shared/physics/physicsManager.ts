import Circle2 from "../math/types/circle2";
import Vec2 from "../math/types/vec2";
import Geometry2D from "../math/util/geometry2D";
import Vector2D from "../math/util/vector2D";
import PhysicsObject from "./physicsObject";
import PhysicsVoxel from "./physicsVoxel";
import PhysicsPosUpdateResult from "./physicsPosUpdateResult";
import RoomServerRecord from "../room/roomServerRecord";
import PhysicsRoom from "./physicsRoom";
import LineSegment2 from "../math/types/lineSegment2";
import RaycastHitResult2 from "../math/types/raycastHitResult2";

const charCode_a = "a".charCodeAt(0);
const charCode_z = "z".charCodeAt(0);
const charCode_A = "A".charCodeAt(0);
const charCode_Z = "Z".charCodeAt(0);

const rooms: {[roomName: string]: PhysicsRoom} = {};

const stringsTemp = new Array<string>();
const voxelsTemp = new Array<PhysicsVoxel>();

const PhysicsManager =
{
    loadRoom: async (roomServerRecord: RoomServerRecord) =>
    {
        if (rooms[roomServerRecord.roomName] != undefined)
            throw new Error(`Physics-room already exists (roomName = ${roomServerRecord.roomName})`);

        const lines = roomServerRecord.roomMap.split("\n").map(x => x.trim()).filter(x => x.length > 0);
        const numGridRows = lines.length;
        const numGridCols = lines[0].length;
        const voxelGrid = new Array<PhysicsVoxel>(numGridRows * numGridCols);

        for (let row = 0; row < numGridRows; ++row)
        {
            const line = lines[row];
            for (let col = 0; col < numGridCols; ++col)
            {
                const voxelCode = line.charCodeAt(col);
                let collisionLayerMask: number = 0;

                if (voxelCode >= charCode_a && voxelCode <= charCode_z)
                {
                    collisionLayerMask |= 0;
                }
                else if (voxelCode >= charCode_A && voxelCode <= charCode_Z)
                {
                    collisionLayerMask |= 1;
                }
                else
                    throw new Error(`Character '${line[col]}' cannot be converted to a physics-voxel.`);

                const intersectingObjects = new Array<PhysicsObject>(4);
                intersectingObjects.length = 0;
                voxelGrid[row * numGridCols + col] = {
                    row, col,
                    collisionLayerMask,
                    collisionShape: { x1: col-0.5, y1: row-0.5, x2: col+0.5, y2: row+0.5 },
                    intersectingObjects,
                };
            }
        }
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

        rooms[roomServerRecord.roomName] = { numGridRows, numGridCols, voxelGrid, objectById };
    },
    unloadAllRooms: async () =>
    {
        stringsTemp.length = 0;
        for (const roomName of Object.keys(rooms))
            stringsTemp.push(roomName);
        for (const roomName of stringsTemp)
            delete rooms[roomName];
    },
    unloadRoom: async (roomName: string) =>
    {
        if (rooms[roomName] == undefined)
            throw new Error(`Physics-room doesn't exist (roomName = ${roomName})`);
        delete rooms[roomName];
    },
    hasRoom: (roomName: string): boolean =>
    {
        return rooms[roomName] != undefined;
    },
    addObject: (roomName: string, objectId: string, collisionShape: Circle2, collisionLayer: number) =>
    {
        const room = rooms[roomName];
        if (rooms[roomName] == undefined)
            throw new Error(`Physics-room doesn't exist (roomName = ${roomName})`);

        if (room.objectById[objectId] != undefined)
            throw new Error(`PhysicsObject is already registered (objectId = ${objectId})`);
        const intersectingVoxels = new Array<PhysicsVoxel>(4);
        intersectingVoxels.length = 0;
        const newObject: PhysicsObject = { objectId, collisionLayer, collisionShape, intersectingVoxels };
        room.objectById[objectId] = newObject;

        setObjectPosition(roomName, objectId, { x: collisionShape.x, y: collisionShape.y });
    },
    tryMoveObject: (roomName: string, objectId: string, targetPos: Vec2): PhysicsPosUpdateResult =>
    {
        const room = rooms[roomName];
        if (rooms[roomName] == undefined)
            throw new Error(`Physics-room doesn't exist (roomName = ${roomName})`);

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

        const minIntersectableX = Math.min(startPos.x, targetPos.x) - object.collisionShape.radius;
        const maxIntersectableX = Math.max(startPos.x, targetPos.x) + object.collisionShape.radius;
        const minIntersectableY = Math.min(startPos.y, targetPos.y) - object.collisionShape.radius;
        const maxIntersectableY = Math.max(startPos.y, targetPos.y) + object.collisionShape.radius;
        const minCol = Math.round(minIntersectableX);
        const maxCol = Math.round(maxIntersectableX);
        const minRow = Math.round(minIntersectableY);
        const maxRow = Math.round(maxIntersectableY);

        // Any attempt to move outside of the room's boundary will force-sync the object back to its original location.
        if (minCol < 0 || minRow < 0 || maxCol >= room.numGridCols || maxRow >= room.numGridRows)
        {
            console.warn(`Physics-position desync due to room boundary limit (startPos = (${startPos.x.toFixed(3)}, ${startPos.y.toFixed(3)}), targetPos = (${targetPos.x.toFixed(3)}, ${targetPos.y.toFixed(3)}, minCol = ${minCol}, minRow = ${minRow}, maxCol = ${maxCol}, maxRow = ${maxRow}))`);
            return { resolvedPos: startPos, desyncDetected: true };
        }

        let minHitRayScale = 1;
        let hitLine: LineSegment2 | undefined;
        for (let row = minRow; row <= maxRow; ++row)
        {
            for (let col = minCol; col <= maxCol; ++col)
            {
                const voxel = room.voxelGrid[row * room.numGridCols + col];
                if (getVoxelCollisionLayer(roomName, row, col, object.collisionLayer) != 0)
                {
                    const result = Geometry2D.circlecastToAABB(object.collisionShape, targetPos, voxel.collisionShape);
                    if (result.hitRayScale <= minHitRayScale)
                    {
                        minHitRayScale = result.hitRayScale;
                        hitLine = result.hitLine;
                    }
                }
            }
        }
        // TODO: Also process collision with other objects (circles).
        // ...

        let resolvedPos = targetPos;

        if (hitLine != undefined)
        {   
            const startToHit = Vector2D.scale(Vector2D.subtract(targetPos, startPos), minHitRayScale);
            const hitPos: Vec2 = Vector2D.add(startPos, startToHit);
            const hitToTarget = Vector2D.subtract(targetPos, hitPos);
            let hitTangent = Vector2D.subtract(hitLine.end, hitLine.start);
            let dot = Vector2D.dot(hitToTarget, hitTangent);
            if (dot < 0)
            {
                // Angle between 'hitToTarget' and 'hitTangent' must be acute
                hitTangent = Vector2D.subtract(hitLine.start, hitLine.end);
                dot = Vector2D.dot(hitToTarget, hitTangent);
            }
            const projectedHitToTarget = Vector2D.scale(hitTangent, dot / Vector2D.dot(hitTangent, hitTangent));
            const slidedHitPos = Vector2D.add(hitPos, projectedHitToTarget);

            const voxelsHitOnSlide = getVoxelsInCircle(roomName, {
                x: slidedHitPos.x,
                y: slidedHitPos.y,
                radius: object.collisionShape.radius,
            });
            let slideBlocked = false;
            for (const voxel of voxelsHitOnSlide)
            {
                if (getVoxelCollisionLayer(roomName, voxel.row, voxel.col, object.collisionLayer) != 0)
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
    forceMoveObject: (roomName: string, objectId: string, targetPos: Vec2) =>
    {
        const room = rooms[roomName];
        if (rooms[roomName] == undefined)
            throw new Error(`Physics-room doesn't exist (roomName = ${roomName})`);

        const object = room.objectById[objectId];
        if (object == undefined)
            throw new Error(`PhysicsObject is not registered (objectId = ${objectId})`);

        object.collisionShape.x = targetPos.x;
        object.collisionShape.y = targetPos.y;
    },
    removeObject: (roomName: string, objectId: string) =>
    {
        const room = rooms[roomName];
        if (rooms[roomName] == undefined)
            throw new Error(`Physics-room doesn't exist (roomName = ${roomName})`);

        const object = room.objectById[objectId];
        if (object == undefined)
            throw new Error(`PhysicsObject is not registered (objectId = ${objectId})`);
        delete room.objectById[objectId];

        removeObjectFromIntersectingVoxels(object);
    },
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

function setObjectPosition(roomName: string, objectId: string, pos: Vec2)
{
    const room = rooms[roomName];
    if (rooms[roomName] == undefined)
        throw new Error(`Physics-room doesn't exist (roomName = ${roomName})`);

    const object = room.objectById[objectId];
    if (object == undefined)
        throw new Error(`PhysicsObject is not registered (objectId = ${objectId})`);

    const voxels = getVoxelsInCircle(roomName, object.collisionShape);
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

function getVoxelsInCircle(roomName: string, circle: Circle2): PhysicsVoxel[]
{
    const room = rooms[roomName];
    if (rooms[roomName] == undefined)
        throw new Error(`Physics-room doesn't exist (roomName = ${roomName})`);

    voxelsTemp.length = 0;
    const row1 = Math.round(circle.y - circle.radius);
    const col1 = Math.round(circle.x - circle.radius);
    const row2 = Math.round(circle.y + circle.radius);
    const col2 = Math.round(circle.x + circle.radius);
    for (let row = row1; row <= row2; ++row)
    {
        for (let col = col1; col <= col2; ++col)
        {
            voxelsTemp.push(room.voxelGrid[row * room.numGridCols + col]);
        }
    }
    return voxelsTemp;
}

function addVoxelCollisionLayer(roomName: string, row: number, col: number, collisionLayer: number)
{
    const room = rooms[roomName];
    if (rooms[roomName] == undefined)
        throw new Error(`Physics-room doesn't exist (roomName = ${roomName})`);

    room.voxelGrid[row * room.numGridCols + col].collisionLayerMask |= (1 << collisionLayer);
}

function removeVoxelCollisionLayer(roomName: string, row: number, col: number, collisionLayer: number)
{
    const room = rooms[roomName];
    if (rooms[roomName] == undefined)
        throw new Error(`Physics-room doesn't exist (roomName = ${roomName})`);

    room.voxelGrid[row * room.numGridCols + col].collisionLayerMask &= ~(1 << collisionLayer);
}

// Returns 1 if the layer exists, or 0 otherwise.
function getVoxelCollisionLayer(roomName: string, row: number, col: number, collisionLayer: number): number
{
    const room = rooms[roomName];
    if (rooms[roomName] == undefined)
        throw new Error(`Physics-room doesn't exist (roomName = ${roomName})`);

    return (room.voxelGrid[row * room.numGridCols + col].collisionLayerMask >> collisionLayer) & 1;
}

export default PhysicsManager;