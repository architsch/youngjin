import Room from "../../room/types/room";
import AABB3 from "../../math/types/aabb3";
import { MAX_ROOM_Y, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import PhysicsObject from "./physicsObject";
import PhysicsVoxel from "./physicsVoxel";

export default class PhysicsRoom
{
    room: Room;
    voxels: PhysicsVoxel[];
    objectById: { [objectId: string]: PhysicsObject };
    floorCollider: AABB3;
    ceilingCollider: AABB3;

    constructor(room: Room)
    {
        this.room = room;
        this.voxels = room.voxelGrid.voxels.map(voxel => new PhysicsVoxel(voxel));
        this.objectById = {};

        // Global floor collider: a large box whose top face sits at y=0
        this.floorCollider = {
            x: NUM_VOXEL_COLS * 0.5,
            y: -50,
            z: NUM_VOXEL_ROWS * 0.5,
            halfSizeX: NUM_VOXEL_COLS * 0.5,
            halfSizeY: 50,
            halfSizeZ: NUM_VOXEL_ROWS * 0.5,
        };
        // Global ceiling collider: a large box whose bottom face sits at y=MAX_ROOM_Y
        this.ceilingCollider = {
            x: NUM_VOXEL_COLS * 0.5,
            y: MAX_ROOM_Y + 50,
            z: NUM_VOXEL_ROWS * 0.5,
            halfSizeX: NUM_VOXEL_COLS * 0.5,
            halfSizeY: 50,
            halfSizeZ: NUM_VOXEL_ROWS * 0.5,
        };
    }
}