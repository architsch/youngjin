import Room from "../../room/types/room";
import { MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z, MID_ROOM_Y } from "../../system/sharedConstants";
import PhysicsObject from "./physicsObject";
import PhysicsVoxel from "./physicsVoxel";
import PhysicsVoxelUtil from "../util/physicsVoxelUtil";
import { ColliderState } from "./colliderState";
import { ColliderConfig } from "./colliderConfig";
import Vec3 from "../../math/types/vec3";

export default class PhysicsRoom
{
    room: Room; // Its voxel blocks are read from it as they stand (see PhysicsColliderStateUtil).
    voxels: PhysicsVoxel[]; // By PhysicsVoxelUtil.getVoxelsInBox.
    objectById: { [objectId: string]: PhysicsObject };
    globalColliders: ColliderState[];

    constructor(room: Room)
    {
        this.room = room;
        this.voxels = PhysicsVoxelUtil.createVoxels();
        this.objectById = {};
        // The boundary is solid all the way round (doors hang on it).
        this.globalColliders = [floor, ceiling, wall_lowerX, wall_upperX, wall_lowerZ, wall_upperZ];
    }
}

const cubeColliderSize = 100;
const cubeColliderSizeHalf = cubeColliderSize*0.5;

const cubeColliderConfig: ColliderConfig = {
    baseHitboxSize: {sizeX: cubeColliderSize, sizeY: cubeColliderSize, sizeZ: cubeColliderSize},
    applyHardCollisionToOthers: true,
    outgoingSoftCollisionForceMultiplier: 1,
    incomingSoftCollisionForceMultiplier: 0,
    maxClimbableHeight: 0,
};
const cubeColliderHalfSize: Vec3 = {x: cubeColliderSizeHalf, y: cubeColliderSizeHalf, z: cubeColliderSizeHalf};

function makeCubeCollider(centerX: number, centerY: number, centerZ: number): ColliderState
{
    return {
        hitbox: {center: {x: centerX, y: centerY, z: centerZ}, halfSize: cubeColliderHalfSize},
        colliderConfig: cubeColliderConfig,
    };
}

const floor = makeCubeCollider(
    MAX_ROOM_X*0.5, -cubeColliderSizeHalf, MAX_ROOM_Z*0.5);
const ceiling = makeCubeCollider(
    MAX_ROOM_X*0.5, MAX_ROOM_Y + cubeColliderSizeHalf, MAX_ROOM_Z*0.5);
const wall_lowerX = makeCubeCollider(
    -cubeColliderSizeHalf, MID_ROOM_Y, MAX_ROOM_Z*0.5);
const wall_upperX = makeCubeCollider(
    MAX_ROOM_X + cubeColliderSizeHalf, MID_ROOM_Y, MAX_ROOM_Z*0.5);
const wall_lowerZ = makeCubeCollider(
    MAX_ROOM_X*0.5, MID_ROOM_Y, -cubeColliderSizeHalf);
const wall_upperZ = makeCubeCollider(
    MAX_ROOM_X*0.5, MID_ROOM_Y, MAX_ROOM_Z + cubeColliderSizeHalf);

