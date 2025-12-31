import Voxel from "./voxel";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"
import { NUM_GRID_COLS, NUM_GRID_ROWS } from "../../system/constants";

export default class VoxelGrid extends EncodableData
{
    voxels: Voxel[];

    constructor(voxels: Voxel[])
    {
        super();
        this.voxels = voxels;
    }

    encode(bufferState: BufferState)
    {
        for (const voxel of this.voxels)
            voxel.encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const numVoxels = NUM_GRID_ROWS * NUM_GRID_COLS;
        const voxels = new Array<Voxel>(numVoxels);
        voxels.length = 0;

        const numGridColsInv = 1 / NUM_GRID_COLS;
        let voxelIndex = 0;

        while (voxelIndex < numVoxels)
        {
            const row = Math.floor(voxelIndex * numGridColsInv);
            const col = voxelIndex % NUM_GRID_COLS;
            if (row < 0 || col < 0 || row >= NUM_GRID_ROWS || col >= NUM_GRID_COLS)
                throw new Error(`Decoded voxel coordinates are out of range (row = ${row}, col = ${col})`);
            const voxel = Voxel.decodeWithParams(bufferState, row, col) as Voxel;
            voxels[voxelIndex++] = voxel;
        }
        return new VoxelGrid(voxels);
    }
}