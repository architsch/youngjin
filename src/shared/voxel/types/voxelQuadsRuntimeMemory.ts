import { NUM_VOXEL_QUADS_PER_ROOM } from "../../system/constants";

export default class VoxelQuadsRuntimeMemory
{
    quads: Uint8Array;

    constructor()
    {
        this.quads = new Uint8Array(NUM_VOXEL_QUADS_PER_ROOM);
    }
}