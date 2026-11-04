import AABB3 from "../math/types/aabb3";
import Vec3 from "../math/types/vec3";
import PhysicsObject from "./types/physicsObject";
import ObjectTransformUpdateResult from "../object/types/objectTransformUpdateResult";
import RoomRuntimeMemory from "../room/types/roomRuntimeMemory";
import PhysicsRoom from "./types/physicsRoom";
import PhysicsColliderStateUtil from "./util/physicsColliderStateUtil";
import PhysicsCollisionUtil from "./util/physicsCollisionUtil";
import PhysicsForceUtil from "./util/physicsForceUtil";
import { ColliderState } from "./types/colliderState";
import ObjectTransform from "../object/types/objectTransform";
import Vector3DUtil from "../math/util/vector3DUtil";
import Geometry3DUtil from "../math/util/geometry3DUtil";
import ObjectTypeConfigMap from "../object/maps/objectTypeConfigMap";
import AdminPrefsUtil from "../object/util/adminPrefsUtil";
import PhysicsVoxelUtil from "./util/physicsVoxelUtil";
import { GRAVITY_SPEED } from "../system/sharedConstants";

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
                obj.objectTypeIndex, obj.transform);
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
        if (PhysicsForceUtil.emitsForce(objectTypeIndex))
            physicsRoom.forceEmitterIds.add(objectId);
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
        physicsRoom.forceEmitterIds.delete(objectId);
        object.onDestroy();
    },
    setObjectTransform: (roomID: string, objectId: string,
        target: ObjectTransform, ignorePhysics: boolean): ObjectTransformUpdateResult =>
    {
        const physicsRoom = physicsRooms[roomID];
        const object = physicsRoom.objectById[objectId];
        const newColliderState = PhysicsColliderStateUtil.getObjectColliderState(object.objectTypeIndex, target);
        if (!newColliderState)
            throw new Error(`ColliderState couldn't be computed (objectId = ${objectId}, objectTypeIndex = ${object.objectTypeIndex})`);

        object.removeFromIntersectingVoxels();

        if (ignorePhysics)
        {
            object.colliderState = newColliderState;
            object.addToIntersectingVoxels();
            return { transform: target, desyncDetected: false };
        }
        else
        {
            const result = PhysicsCollisionUtil.applyHardCollision(physicsRoom, object, target);
            // The sweep resolves where the object ends up, but its size is the target's: a resize that
            // happens mid-motion must reach the live state, or the box stays at its old extents.
            object.colliderState.hitbox.halfSize = newColliderState.hitbox.halfSize;
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
    // Returns the velocity with what the room's force emitters have given the object added, after a step of
    // deltaTime under them (see PhysicsForceUtil). Once per step, with gravity already in the velocity and after
    // the adjustment, whose limit on a push doesn't hold this one back.
    applyForces: (roomID: string, objectId: string, velocity: Vec3, deltaTime: number): Vec3 =>
    {
        const physicsRoom = physicsRooms[roomID];
        return PhysicsForceUtil.applyForces(physicsRoom, physicsRoom.objectById[objectId], velocity, deltaTime);
    },
    // See PhysicsForceUtil.getStrongestStream.
    getStrongestStream: (roomID: string, box: AABB3) =>
    {
        return PhysicsForceUtil.getStrongestStream(physicsRooms[roomID], box);
    },
    // Whether a straight line between two points meets no object's collider, but for the one it is seen from: of an object
    // whose type draws something, as the collider stands for what of it hides whatever lies behind it, the way a block
    // does (see VoxelQueryUtil.isLineClear). A volume, which draws nothing, hides nothing, nor does a ghost, drawn for
    // nobody (see AdminPrefsUtil.isGhost).
    isLineClearOfObjects: (roomID: string, from: Vec3, to: Vec3, viewerObjectId: string): boolean =>
    {
        const physicsRoom = physicsRooms[roomID];
        const lineBox: AABB3 = {
            center: Vector3DUtil.scale(Vector3DUtil.add(from, to), 0.5),
            halfSize: {x: 0.5 * Math.abs(to.x - from.x), y: 0.5 * Math.abs(to.y - from.y), z: 0.5 * Math.abs(to.z - from.z)},
        };
        const point: AABB3 = {center: from, halfSize: {x: 0, y: 0, z: 0}};
        const checked = new Set<string>([viewerObjectId]);
        for (const voxel of PhysicsVoxelUtil.getVoxelsInBox(physicsRoom, lineBox))
        {
            for (const object of voxel.intersectingObjects)
            {
                if (checked.has(object.objectId))
                    continue;
                checked.add(object.objectId);
                if (ObjectTypeConfigMap.getConfigByIndex(object.objectTypeIndex).components.spawnedByAny?.instancedMeshGraphics
                    != undefined && !AdminPrefsUtil.isGhost(physicsRoom.room.objectById[object.objectId])
                    && Geometry3DUtil.castAABBAgainstAABB(point, to, object.colliderState.hitbox).hitRayScale < 1)
                    return false;
            }
        }
        return true;
    },
    // The velocity a walking body moves at for one step, whoever walks it (a browser's player, a server-walked
    // agent): its steering, falling at gravity's speed, then the two above. Moving the body by it, through the hard
    // collisions, is the caller's (see Rigidbody). underForce: whether a force had a part in it.
    getStepVelocity: (roomID: string, objectId: string, steering: Vec3,
        deltaTime: number): {velocity: Vec3, underForce: boolean} =>
    {
        const adjusted = PhysicsManager.getAdjustedVelocity(roomID, objectId,
            {x: steering.x, y: steering.y - GRAVITY_SPEED, z: steering.z});
        const velocity = PhysicsManager.applyForces(roomID, objectId, adjusted, deltaTime);
        return {velocity, underForce: !Vector3DUtil.equal(velocity, adjusted)};
    },
}

export default PhysicsManager;
