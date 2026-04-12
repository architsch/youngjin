import Room from "../../room/types/room";
import { MAX_ROOM_Y, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import PhysicsObject from "./physicsObject";
import PhysicsVoxel from "./physicsVoxel";
import { ColliderState } from "./colliderState";

export default class PhysicsRoom
{
    room: Room;
    voxels: PhysicsVoxel[];
    objectById: { [objectId: string]: PhysicsObject };
    floor: ColliderState; // Global floor collider
    ceiling: ColliderState; // Global ceiling collider

    constructor(room: Room)
    {
        this.room = room;
        this.voxels = room.voxelGrid.voxels.map(voxel => new PhysicsVoxel(voxel));
        this.objectById = {};

        this.floor = defaultFloor;
        this.ceiling = defaultCeiling;
    }
}

const defaultFloor: ColliderState = {
    hitbox: {
        center: {
            x: NUM_VOXEL_COLS * 0.5,
            y: -50,
            z: NUM_VOXEL_ROWS * 0.5
        },
        halfSize: {
            x: NUM_VOXEL_COLS * 0.5,
            y: 50,
            z: NUM_VOXEL_ROWS * 0.5
        },
    },
    colliderConfig: {
        colliderType: "standalone",
        hitboxSize: {sizeX: NUM_VOXEL_COLS, sizeY: 100, sizeZ: NUM_VOXEL_ROWS},
        applyHardCollisionToOthers: true,
        outgoingSoftCollisionForceMultiplier: 1,
        incomingSoftCollisionForceMultiplier: 0,
        maxClimbableHeight: 0,
    },
};

const defaultCeiling: ColliderState = {
    hitbox: {
        center: {
            x: NUM_VOXEL_COLS * 0.5,
            y: MAX_ROOM_Y + 50,
            z: NUM_VOXEL_ROWS * 0.5
        },
        halfSize: {
            x: NUM_VOXEL_COLS * 0.5,
            y: 50,
            z: NUM_VOXEL_ROWS * 0.5
        },
    },
    colliderConfig: {
        colliderType: "standalone",
        hitboxSize: {sizeX: NUM_VOXEL_COLS, sizeY: 100, sizeZ: NUM_VOXEL_ROWS},
        applyHardCollisionToOthers: true,
        outgoingSoftCollisionForceMultiplier: 1,
        incomingSoftCollisionForceMultiplier: 0,
        maxClimbableHeight: 0,
    },
};