import Geometry3DUtil from "../../math/util/geometry3DUtil";
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
                if (Geometry3DUtil.AABBsOverlap(volumeColliderState.hitbox, obj.colliderState.hitbox))
                {
                    objs[obj.objectId] = obj;
                }
            }
        }
        return objs;
    },
    getObjectsIn2DDist: (roomID: string,
        centerX: number, centerZ: number, dist: number): {[objectId: string]: PhysicsObject} =>
    {
        const physicsRoom = PhysicsManager.physicsRooms[roomID];
        if (PhysicsManager.physicsRooms[roomID] == undefined)
            throw new Error(`Physics-room doesn't exist (roomID = ${roomID})`);

        const voxels = PhysicsVoxelUtil.getVoxelsInBox(physicsRoom, {
            center: {
                x: centerX,
                y: 0,
                z: centerZ
            },
            halfSize: {
                x: dist,
                y: 1000,
                z: dist
            },
        });
        const objs: {[objectId: string]: PhysicsObject} = {};
        for (const voxel of voxels)
        {
            for (const obj of voxel.intersectingObjects)
            {
                if (objs[obj.objectId] != undefined)
                    continue;
                const offsetX = obj.colliderState.hitbox.center.x - centerX;
                const offsetZ = obj.colliderState.hitbox.center.z - centerZ;
                const distSqr = offsetX*offsetX + offsetZ*offsetZ;
                if (distSqr <= dist * dist)
                    objs[obj.objectId] = obj;
            }
        }
        return objs;
    },
}

export default PhysicsObjectUtil;