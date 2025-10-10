import Voxel from "./voxel";
import VoxelType from "./voxelType";

let numGridRows: number = 0;
let numGridCols: number = 0;
let voxelGrid: Voxel[] = [];
let voxelByMeshInstanceId: { [id: string]: Voxel } = {};

const voxelsTemp: Voxel[] = new Array<Voxel>(1024);

const VoxelManager =
{
    getVoxelByMeshInstanceId: (id: string): Voxel =>
    {
        const voxel = voxelByMeshInstanceId[id];
        if (voxel == undefined)
            throw new Error(`Voxel not found (id = ${id})`);
        return voxel;
    },
    registerVoxelByMeshInstanceId: (id: string, voxel: Voxel): void =>
    {
        if (voxelByMeshInstanceId[id] != undefined)
            throw new Error(`Voxel already exists (id = ${id})`);
        voxelByMeshInstanceId[id] = voxel;
    },
    unregisterVoxelByMeshInstanceId: (id: string): void =>
    {
        if (voxelByMeshInstanceId[id] == undefined)
            throw new Error(`Voxel not found (id = ${id})`);
        delete voxelByMeshInstanceId[id];
    },
    getVoxelsInCircle: (centerX: number, centerZ: number, radius: number): Voxel[] =>
    {
        voxelsTemp.length = 0;

        const row1 = Math.max(0, Math.floor(centerZ - radius));
        const row2 = Math.min(numGridRows-1, Math.ceil(centerZ + radius));
        const col1 = Math.max(0, Math.floor(centerX - radius));
        const col2 = Math.min(numGridCols-1, Math.ceil(centerX + radius));
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
                    voxelsTemp.push(voxelGrid[row * numGridCols + col]);
            }
        }
        return voxelsTemp;
    },
    forEachVoxelAsync: async (callback: (voxel: Voxel) => Promise<void>) =>
    {
        for (let i = 0; i < voxelGrid.length; ++i)
        {
            const voxel = voxelGrid[i];
            await callback(voxel);
        }
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
                    object: undefined,
                };
            }
        }
    },
    unload: async () =>
    {
        numGridRows = 0;
        numGridCols = 0;
        voxelGrid = [];
        voxelByMeshInstanceId = {};
    },
}

export default VoxelManager;