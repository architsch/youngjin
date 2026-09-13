import { MAX_VISIBLE_VOXEL_QUADS_PER_ROOM, NUM_VOXEL_QUADS_PER_ROOM } from "../../../shared/system/sharedConstants";

// Maps between voxel quads and voxel mesh instances. Only visible quads hold an instance (every
// instance costs per-frame work even when parked, and most addressable faces are buried). Dense arrays
// in both directions for fast lookups.

const NO_INSTANCE = -1;
const NO_QUAD = -1;

const instanceIdByQuadIndex = new Int32Array(NUM_VOXEL_QUADS_PER_ROOM).fill(NO_INSTANCE);
const quadIndexByInstanceId = new Int32Array(MAX_VISIBLE_VOXEL_QUADS_PER_ROOM).fill(NO_QUAD);

const VoxelQuadInstanceUtil =
{
    // The instance drawing this quad, or -1 while the quad is not on show and so holds none.
    getInstanceId(quadIndex: number): number
    {
        if (quadIndex < 0 || quadIndex >= NUM_VOXEL_QUADS_PER_ROOM)
            return NO_INSTANCE;
        return instanceIdByQuadIndex[quadIndex];
    },

    // The quad an instance draws, or -1 if none (so stale ids aren't reported).
    getQuadIndex(instanceId: number): number
    {
        if (instanceId < 0 || instanceId >= MAX_VISIBLE_VOXEL_QUADS_PER_ROOM)
            return NO_QUAD;
        return quadIndexByInstanceId[instanceId];
    },

    bind(quadIndex: number, instanceId: number): void
    {
        instanceIdByQuadIndex[quadIndex] = instanceId;
        quadIndexByInstanceId[instanceId] = quadIndex;
    },

    unbind(quadIndex: number, instanceId: number): void
    {
        instanceIdByQuadIndex[quadIndex] = NO_INSTANCE;
        quadIndexByInstanceId[instanceId] = NO_QUAD;
    },
}

export default VoxelQuadInstanceUtil;
