import { NUM_VOXEL_BLOCKS, NUM_VOXEL_QUADS_PER_ROOM } from "../../system/sharedConstants";

export default class VoxelQuadsRuntimeMemory
{
    // One texture index per quad.
    quads: Uint8Array;

    // One shape per block, by VoxelQueryUtil.getVoxelBlockIndex. Stored within the quads' own bytes when
    // encoded (see Voxel), but kept apart here so that a quad's byte is only ever its texture.
    blockShapes: Uint8Array;

    constructor()
    {
        this.quads = new Uint8Array(NUM_VOXEL_QUADS_PER_ROOM);
        this.blockShapes = new Uint8Array(NUM_VOXEL_BLOCKS);
    }
}
