import Vec3 from "../math/types/vec3";
import PhysicsObject from "./types/physicsObject";
import ObjectTransformUpdateResult from "../object/types/objectTransformUpdateResult";
import RoomRuntimeMemory from "../room/types/roomRuntimeMemory";
import PhysicsRoom from "./types/physicsRoom";
import PhysicsColliderStateUtil from "./util/physicsColliderStateUtil";
import PhysicsCollisionUtil from "./util/physicsCollisionUtil";
import { ColliderState } from "./types/colliderState";
import ObjectTransform from "../object/types/objectTransform";

const physicsRooms: {[roomID: string]: PhysicsRoom} = {};

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
            const colliderState = PhysicsColliderStateUtil.getObjectColliderState(
                obj.objectTypeIndex, obj.transform.pos, obj.transform.dir);
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
    setObjectTransform: (roomID: string, objectId: string,
        targetPos: Vec3, targetDir: Vec3, ignorePhysics: boolean): ObjectTransformUpdateResult =>
    {
        const physicsRoom = physicsRooms[roomID];
        const object = physicsRoom.objectById[objectId];
        const newColliderState = PhysicsColliderStateUtil.getObjectColliderState(object.objectTypeIndex, targetPos, targetDir);
        if (!newColliderState)
            throw new Error(`ColliderState couldn't be computed (objectId = ${objectId}, objectTypeIndex = ${object.objectTypeIndex})`);

        object.removeFromIntersectingVoxels();

        if (ignorePhysics)
        {
            object.colliderState = newColliderState;
            object.addToIntersectingVoxels();
            return { transform: new ObjectTransform(targetPos, targetDir), desyncDetected: false };
        }
        else
        {
            const result = PhysicsCollisionUtil.applyHardCollision(physicsRoom, object, targetPos, targetDir);
            object.colliderState.hitbox.center.x = result.transform.pos.x;
            object.colliderState.hitbox.center.y = result.transform.pos.y;
            object.colliderState.hitbox.center.z = result.transform.pos.z;
            object.addToIntersectingVoxels();
            return result;
        }
    },
    // Returns the adjusted velocity.
    getAdjustedVelocity: (roomID: string, objectId: string, desiredVelocity: Vec3): Vec3 =>
    {
        const physicsRoom = physicsRooms[roomID];
        const object = physicsRoom.objectById[objectId];
        return PhysicsCollisionUtil.applySoftCollision(physicsRoom, object, desiredVelocity);
    },
}

export default PhysicsManager;
