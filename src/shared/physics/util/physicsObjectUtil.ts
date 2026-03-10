import Geometry2DUtil from "../../math/util/geometry2DUtil";
import PhysicsManager from "../physicsManager";
import { ColliderInfo } from "../types/colliderInfo";
import PhysicsObject from "../types/physicsObject";
import PhysicsVoxelUtil from "./physicsVoxelUtil";

const PhysicsObjectUtil =
{
    getObjectsCollidingWith3DVolume: (roomID: string,
        volumeColliderInfo: ColliderInfo): {[objectId: string]: PhysicsObject} =>
    {
        const physicsRoom = PhysicsManager.physicsRooms[roomID];
        if (PhysicsManager.physicsRooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

        const voxels = PhysicsVoxelUtil.getVoxelsInBox(physicsRoom, volumeColliderInfo.hitbox);
        const objs: {[objectId: string]: PhysicsObject} = {};
        for (const voxel of voxels)
        {
            for (const obj of voxel.intersectingObjects)
            {
                if (objs[obj.objectId] != undefined)
                    continue;
                if ((obj.colliderInfo.collisionLayerMask & volumeColliderInfo.collisionLayerMask) != 0 &&
                    Geometry2DUtil.AABBsOverlap(volumeColliderInfo.hitbox, obj.colliderInfo.hitbox))
                {
                    objs[obj.objectId] = obj;
                }
            }
        }
        return objs;
    },
    getObjectsIn2DDist: (roomID: string,
        centerX: number, centerY: number, dist: number): {[objectId: string]: PhysicsObject} =>
    {
        const physicsRoom = PhysicsManager.physicsRooms[roomID];
        if (PhysicsManager.physicsRooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

        const voxels = PhysicsVoxelUtil.getVoxelsInBox(physicsRoom, {
            x: centerX,
            y: centerY,
            halfSizeX: dist,
            halfSizeY: dist,
        });
        const objs: {[objectId: string]: PhysicsObject} = {};
        for (const voxel of voxels)
        {
            for (const obj of voxel.intersectingObjects)
            {
                if (objs[obj.objectId] != undefined)
                    continue;
                const offsetX = obj.colliderInfo.hitbox.x - centerX;
                const offsetY = obj.colliderInfo.hitbox.y - centerY;
                const distSqr = offsetX*offsetX + offsetY*offsetY;
                if (distSqr <= dist * dist)
                    objs[obj.objectId] = obj;
            }
        }
        return objs;
    },
}

export default PhysicsObjectUtil;