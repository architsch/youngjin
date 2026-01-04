import Vec2 from "../../math/types/vec2";
import { COLLISION_LAYER_MIN, COLLISION_LAYER_NULL } from "../../system/constants";
import PhysicsObject from "../types/physicsObject";
import PhysicsRoom from "../types/physicsRoom";
import PhysicsVoxel from "../types/physicsVoxel";
import { getVoxelsInBox } from "./physicsVoxelUtil";

const voxelsTemp = new Array<PhysicsVoxel>();
const objsTemp = new Array<PhysicsObject>();

export function canObjectCollideWithLayer(object: PhysicsObject, collisionLayer: number,
    levelShiftInObject: number = 0): boolean
{
    const currMask = object.collisionLayerMaskAtGroundLevel << (object.level + levelShiftInObject);
    return (currMask & (1 << collisionLayer)) != 0;
}

// Returns COLLISION_LAYER_NULL if no layer is occupied
export function getLowestObjectCollisionLayer(object: PhysicsObject): number
{
    let layer = COLLISION_LAYER_MIN;
    let maskTemp = object.collisionLayerMaskAtGroundLevel << object.level;
    while ((maskTemp & 0b00000001) == 0)
    {
        maskTemp >>= 1;
        if (maskTemp == 0)
            return COLLISION_LAYER_NULL;
        layer++;
    }
    return layer;
}

export function getObjectsInDist(physicsRoom: PhysicsRoom, centerX: number, centerY: number, dist: number): PhysicsObject[]
{
    const voxels = getVoxelsInBox(physicsRoom, {
        x: centerX,
        y: centerY,
        halfSizeX: dist,
        halfSizeY: dist,
    });
    objsTemp.length = 0;
    for (const voxel of voxels)
    {
        for (const obj of voxel.intersectingObjects)
        {
            const offsetX = obj.hitbox.x - centerX;
            const offsetY = obj.hitbox.y - centerY;
            const distSqr = offsetX*offsetX + offsetY*offsetY;
            if (distSqr <= dist * dist)
                objsTemp.push(obj);
        }
    }
    return objsTemp;
}

export function addObjectToVoxel(object: PhysicsObject, voxel: PhysicsVoxel)
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
}

export function setObjectPosition(physicsRoom: PhysicsRoom, objectId: string, pos: Vec2)
{
    const object = physicsRoom.objectById[objectId];
    if (object == undefined)
        throw new Error(`PhysicsObject is not registered (objectId = ${objectId})`);

    const voxels = getVoxelsInBox(physicsRoom, object.hitbox);
    object.hitbox.x = pos.x;
    object.hitbox.y = pos.y;

    removeObjectFromIntersectingVoxels(object);
    for (const voxel of voxels)
        addObjectToVoxel(object, voxel);
}

export function removeObjectFromIntersectingVoxels(object: PhysicsObject)
{
    voxelsTemp.length = 0;
    for (const voxel of object.intersectingVoxels)
        voxelsTemp.push(voxel);
    for (const voxel of voxelsTemp)
        removeObjectFromVoxel(object, voxel);
}

export function removeObjectFromVoxel(object: PhysicsObject, voxel: PhysicsVoxel)
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