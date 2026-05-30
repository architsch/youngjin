import Room from "../../room/types/room";
import { MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, MAX_ROOM_Y, MID_ROOM_Y, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import PhysicsObject from "./physicsObject";
import PhysicsVoxel from "./physicsVoxel";
import { ColliderState } from "./colliderState";
import { ColliderConfig } from "./colliderConfig";
import Vec3 from "../../math/types/vec3";
import { RoomTypeEnumMap } from "../../room/types/roomType";

export default class PhysicsRoom
{
    room: Room;
    voxels: PhysicsVoxel[];
    objectById: { [objectId: string]: PhysicsObject };
    globalColliders: ColliderState[];

    constructor(room: Room)
    {
        this.room = room;
        this.voxels = room.voxelGrid.voxels.map(voxel => new PhysicsVoxel(voxel));
        this.objectById = {};
        this.globalColliders = [floor, ceiling, wall_lowerX, wall_upperX, wall_lowerZ, wall_upperZ];
        if (room.roomType != RoomTypeEnumMap.SinglePlayer) // Invisible entrance-clearance collider is only used in multiplayer rooms (to prevent other players from completely blocking the entrance door).
            this.globalColliders.push(entrance);
    }
}

const cubeColliderSize = 100;
const cubeColliderSizeHalf = cubeColliderSize*0.5;

const cubeColliderConfig: ColliderConfig = {
    colliderType: "standalone",
    hitboxSize: {sizeX: cubeColliderSize, sizeY: cubeColliderSize, sizeZ: cubeColliderSize},
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
    NUM_VOXEL_COLS*0.5, -cubeColliderSizeHalf, NUM_VOXEL_ROWS*0.5);
const ceiling = makeCubeCollider(
    NUM_VOXEL_COLS*0.5, MAX_ROOM_Y + cubeColliderSizeHalf, NUM_VOXEL_ROWS*0.5);
const wall_lowerX = makeCubeCollider(
    -cubeColliderSizeHalf, MID_ROOM_Y, NUM_VOXEL_ROWS*0.5);
const wall_upperX = makeCubeCollider(
    NUM_VOXEL_COLS + cubeColliderSizeHalf, MID_ROOM_Y, NUM_VOXEL_ROWS*0.5);
const wall_lowerZ = makeCubeCollider(
    NUM_VOXEL_COLS*0.5, MID_ROOM_Y, -cubeColliderSizeHalf);
const wall_upperZ = makeCubeCollider(
    NUM_VOXEL_COLS*0.5, MID_ROOM_Y, NUM_VOXEL_ROWS + cubeColliderSizeHalf);

const entrance: ColliderState = {
    hitbox: {
        center: {x: MULTI_PLAYER_ENTRANCE_VOXEL_COL + 0.5, y: MID_ROOM_Y, z: MULTI_PLAYER_ENTRANCE_VOXEL_ROW},
        halfSize: {x: 0.5, y: 0.5*MAX_ROOM_Y, z: 1},
    },
    colliderConfig: {
            colliderType: "standalone",
        hitboxSize: {sizeX: 1, sizeY: MAX_ROOM_Y, sizeZ: 2},
        applyHardCollisionToOthers: true,
        outgoingSoftCollisionForceMultiplier: 0,
        incomingSoftCollisionForceMultiplier: 0,
        maxClimbableHeight: 0,
    },
};