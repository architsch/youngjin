import { NUM_VOXEL_QUADS_PER_ROOM } from "../../system/sharedConstants";

export default class VoxelQuadsRuntimeMemory
{
    // One texture index per quad.
    quads: Uint8Array;

    constructor()
    {
        this.quads = new Uint8Array(NUM_VOXEL_QUADS_PER_ROOM);
    }
}
