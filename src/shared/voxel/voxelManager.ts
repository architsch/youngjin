import Voxel from "./voxel";
import VoxelGrid from "./voxelGrid";

let voxelGrid: VoxelGrid;

const voxelsTemp: Voxel[] = new Array<Voxel>(1024);

const VoxelManager =
{
    getNumGridRows: (): number =>
    {
        return voxelGrid!.numGridRows;
    },
    getNumGridCols: (): number =>
    {
        return voxelGrid!.numGridCols;
    },
    getVoxelsInCircle: (centerX: number, centerZ: number, radius: number): Voxel[] =>
    {
        voxelsTemp.length = 0;

        const row1 = Math.max(0, Math.floor(centerZ - radius));
        const row2 = Math.min(voxelGrid!.numGridRows-1, Math.ceil(centerZ + radius));
        const col1 = Math.max(0, Math.floor(centerX - radius));
        const col2 = Math.min(voxelGrid!.numGridCols-1, Math.ceil(centerX + radius));
        const radiusSqr = radius * radius;

        for (let row = row1; row <= row2; ++row)
        {
            let rowDiffSqr = row - centerZ;
            rowDiffSqr = rowDiffSqr * rowDiffSqr;
            for (let col = col1; col <= col2; ++col)
            {
                let colDiffSqr = col - centerX;
                colDiffSqr = colDiffSqr * colDiffSqr;
                if (rowDiffSqr + colDiffSqr <= radiusSqr)
                    voxelsTemp.push(voxelGrid!.voxels[row * voxelGrid!.numGridCols + col]);
            }
        }
        return voxelsTemp;
    },
    forEachVoxelAsync: async (callback: (voxel: Voxel) => Promise<void>) =>
    {
        for (let i = 0; i < voxelGrid!.voxels.length; ++i)
        {
            const voxel = voxelGrid!.voxels[i];
            await callback(voxel);
        }
    },
    load: async (voxelGridToLoad: VoxelGrid) =>
    {
        voxelGrid = voxelGridToLoad;
    },
    unload: async () =>
    {
    },
}

export default VoxelManager;