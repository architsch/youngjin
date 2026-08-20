import { MAX_VISIBLE_VOXEL_QUADS_PER_ROOM, NUM_VOXEL_QUADS_PER_ROOM } from "../../../shared/system/sharedConstants";

//------------------------------------------------------------------------
// Which mesh instance is drawing which of the room's voxel quads.
//
// The grid addresses far more quads than a room can ever show at once: every face of every layer of
// every cell has an index, while a face is only ever drawn where something solid meets something
// open. So a quad holds an instance of the room's voxel mesh for exactly as long as it is on show,
// and hands it back the moment it is not, rather than every quad in the grid owning one for the
// room's whole lifetime.
//
// That is worth doing because an instance costs something every frame whether or not it is drawing
// anything: an instanced mesh is drawn as one call over a fixed range of instances, so an instance
// standing for a face buried inside a wall is still transformed, and still has its matrix read off
// the GPU, exactly like one holding a wall the user is looking at. Parking those out of sight keeps
// them off the screen but not out of the frame's work — which, over a grid this size, is most of
// the work the room costs.
//
// The two directions are both needed and both have to be cheap: drawing an edited quad has to find
// its instance, and a pointer landing on an instance (or the orbit camera taking one out of the
// way) has to find the quad it belongs to. Dense arrays rather than maps, since both ids are small
// integers bounded by the grid and the mesh, and both are looked up per quad of a room being built.
//------------------------------------------------------------------------

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

    // The quad an instance is drawing, or -1 while the instance is holding nothing. This is what a
    // pointer landing on the room's mesh is answered by, so it has to be able to say "nothing"
    // rather than name whichever quad held the instance last.
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
