import RoomRuntimeMemory from "../room/roomRuntimeMemory";
import Voxel from "./voxel";
import VoxelGrid from "./voxelGrid";
import VoxelGridEncoding from "./voxelGridEncoding";

const voxelGrids: {[roomID: string]: VoxelGrid} = {};

const voxelsTemp: Voxel[] = new Array<Voxel>(1024);

const VoxelManager =
{
    loadRoom: (roomRuntimeMemory: RoomRuntimeMemory, decodedVoxelGrid: VoxelGrid) =>
    {
        if (voxelGrids[roomRuntimeMemory.room.roomID] != undefined)
            throw new Error(`VoxelGrid already exists (roomID = ${roomRuntimeMemory.room.roomID})`);
        voxelGrids[roomRuntimeMemory.room.roomID] = decodedVoxelGrid;
    },
    unloadRoom: (roomID: string) =>
    {
        if (voxelGrids[roomID] == undefined)
            throw new Error(`VoxelGrid doesn't exist (roomID = ${roomID})`);
        delete voxelGrids[roomID];
    },
    getEncodedVoxelGrid: (roomID: string): string =>
    {
        const voxelGrid = voxelGrids[roomID];
        if (voxelGrids[roomID] == undefined)
            throw new Error(`VoxelGrid doesn't exist (roomID = ${roomID})`);
        return VoxelGridEncoding.encode(voxelGrid);
    },
    getVoxelsInCircle: (roomID: string, centerX: number, centerZ: number, radius: number): Voxel[] =>
    {
        voxelsTemp.length = 0;
        const voxelGrid = voxelGrids[roomID];
        if (voxelGrids[roomID] == undefined)
            throw new Error(`VoxelGrid doesn't exist (roomID = ${roomID})`);

        const row1 = Math.max(0, Math.floor(centerZ - radius));
        const row2 = Math.min(voxelGrid.numGridRows-1, Math.floor(centerZ + radius));
        const col1 = Math.max(0, Math.floor(centerX - radius));
        const col2 = Math.min(voxelGrid.numGridCols-1, Math.floor(centerX + radius));
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
                    voxelsTemp.push(voxelGrid.voxels[row * voxelGrid.numGridCols + col]);
            }
        }
        return voxelsTemp;
    },
}

export default VoxelManager;