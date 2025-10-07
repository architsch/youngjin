import Voxel from "./voxel";
import VoxelType from "./voxelType";

let numGridRows: number = 0;
let numGridCols: number = 0;
let voxelGrid: Voxel[] = [];

const VoxelManager =
{
    getVoxelGrid: (): Voxel[] =>
    {
        return voxelGrid;
    },
    load: async (roomMap: string) =>
    {
        const lines = roomMap.split("\n").map(x => x.trim()).filter(x => x.length > 0);
        numGridRows = lines.length;
        numGridCols = lines[0].length;
        voxelGrid = new Array<Voxel>(numGridRows * numGridCols);

        for (let row = 0; row < numGridRows; ++row)
        {
            const line = lines[row];
            for (let col = 0; col < numGridCols; ++col)
            {
                const voxelCode = line[col];
                let voxelType: VoxelType = "Floor";

                if (voxelCode >= "a" && voxelCode <= "z")
                    voxelType = "Floor";
                else if (voxelCode >= "A" && voxelCode <= "Z")
                    voxelType = "Wall";

                voxelGrid[row * numGridCols + col] = {
                    voxelType,
                    textureId: voxelCode,
                    row, col,
                };
            }
        }
    },
    unload: () =>
    {
        numGridRows = 0;
        numGridCols = 0;
        voxelGrid = [];
    },
}

export default VoxelManager;