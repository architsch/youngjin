import Geometry2DUtil from "../../math/util/geometry2DUtil";
import PhysicsManager from "../physicsManager";
import { ColliderState } from "../types/colliderState";
import PhysicsObject from "../types/physicsObject";
import PhysicsVoxelUtil from "./physicsVoxelUtil";

const PhysicsObjectUtil =
{
    getObjectsCollidingWith3DVolume: (roomID: string,
        volumeColliderState: ColliderState): {[objectId: string]: PhysicsObject} =>
    {
        const physicsRoom = PhysicsManager.physicsRooms[roomID];
        if (PhysicsManager.physicsRooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

        const voxels = PhysicsVoxelUtil.getVoxelsInBox(physicsRoom, volumeColliderState.hitbox);
        const objs: {[objectId: string]: PhysicsObject} = {};
        for (const voxel of voxels)
        {
            for (const obj of voxel.intersectingObjects)
            {
                if (objs[obj.objectId] != undefined)
                    continue;
                if ((obj.colliderState.collisionLayerMask & volumeColliderState.collisionLayerMask) != 0 &&
                    Geometry2DUtil.AABBsOverlap(volumeColliderState.hitbox, obj.colliderState.hitbox))
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
                const offsetX = obj.colliderState.hitbox.x - centerX;
                const offsetY = obj.colliderState.hitbox.y - centerY;
                const distSqr = offsetX*offsetX + offsetY*offsetY;
                if (distSqr <= dist * dist)
                    objs[obj.objectId] = obj;
            }
        }
        return objs;
    },
}

export default PhysicsObjectUtil;