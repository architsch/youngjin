import VoxelQuadSelection from "./voxelQuadSelection";

export default class WorldSpaceSelection
{
    static unselectAll()
    {
        VoxelQuadSelection.unselect();
    }
}