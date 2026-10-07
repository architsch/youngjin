import { voxelQuadChangeObservable } from "../../system/sharedObservables";
import Voxel from "../types/voxel";
import VoxelQuadChange from "../types/voxelQuadChange";

let debugEnabled = false;

const VoxelQuadUpdateUtil =
{
    setVoxelQuadUpdateUtilDebugEnabled(enabled: boolean)
    {
        debugEnabled = enabled;
    },

    // Writes a quad's texture. Returns whether that changed it, having announced the quad if so.
    setVoxelQuadTexture(voxel: Voxel, quadIndex: number, textureIndex: number): boolean
    {
        const newQuad = textureIndex & 0b01111111;
        if (newQuad == voxel.quadsMem.quads[quadIndex])
            return false; // no change

        voxel.quadsMem.quads[quadIndex] = newQuad;
        VoxelQuadUpdateUtil.announceVoxelQuadChange(voxel, quadIndex);
        return true;
    },

    // Announces a quad to be drawn again: one whose texture changed, or which a block added or removed
    // beside it has just covered or uncovered (see VoxelQueryUtil.isVoxelQuadVisible).
    announceVoxelQuadChange(voxel: Voxel, quadIndex: number)
    {
        const change = new VoxelQuadChange(quadIndex, voxel.quadsMem.quads[quadIndex]);
        if (debugEnabled)
            change.voxelQuadsResultSnapshot = String(voxel);

        voxelQuadChangeObservable.set(change);
    },
};

export default VoxelQuadUpdateUtil;
