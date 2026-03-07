import { voxelQuadChangeObservable } from "../../system/sharedObservables";
import Voxel from "../types/voxel";
import VoxelQuadChange from "../types/voxelQuadChange";
import VoxelQueryUtil from "./voxelQueryUtil";

let debugEnabled = false;

const VoxelQuadUpdateUtil =
{
    setVoxelQuadUpdateUtilDebugEnabled(enabled: boolean)
    {
        debugEnabled = enabled;
    },

    setVoxelQuadVisible(visible: boolean, voxel: Voxel,
        facingAxis: "x" | "y" | "z", orientation: "-" | "+", collisionLayer: number,
        textureIndex: number = -1): boolean // (textureIndex == -1) if the quad's textureIndex should stay the same as before
    {
        const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(voxel.row, voxel.col, facingAxis, orientation, collisionLayer);
        const oldQuad = voxel.quadsMem.quads[quadIndex];
        const newTextureIndex = (textureIndex >= 0) ? textureIndex : (oldQuad & 0b01111111);
        const newQuad = (newTextureIndex & 0b01111111) | (visible ? 0b10000000 : 0b00000000);

        if (newQuad == oldQuad)
            return false; // no change

        voxel.quadsMem.quads[quadIndex] = newQuad;

        const change = new VoxelQuadChange(quadIndex, newQuad);
        if (debugEnabled)
            change.voxelQuadsResultSnapshot = String(voxel);

        voxelQuadChangeObservable.set(change);
        return true;
    },
};

export default VoxelQuadUpdateUtil;
