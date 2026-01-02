import Voxel from "./voxel";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/constants";
import VoxelQuadsRuntimeMemory from "./voxelQuadsRuntimeMemory";

export default class VoxelGrid extends EncodableData
{
    voxels: Voxel[];
    quadsMem: VoxelQuadsRuntimeMemory; // This field is NOT part of the encoded data.

    constructor(voxels: Voxel[], quadsMem: VoxelQuadsRuntimeMemory)
    {
        super();
        this.voxels = voxels;
        this.quadsMem = quadsMem;
    }

    encode(bufferState: BufferState)
    {
        for (const voxel of this.voxels)
            voxel.encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const numVoxels = NUM_VOXEL_ROWS * NUM_VOXEL_COLS;
        const voxels = new Array<Voxel>(numVoxels);
        voxels.length = 0;

        const numGridColsInv = 1 / NUM_VOXEL_COLS;
        let voxelIndex = 0;

        const quadsMem = new VoxelQuadsRuntimeMemory();
        while (voxelIndex < numVoxels)
        {
            const row = Math.floor(voxelIndex * numGridColsInv);
            const col = voxelIndex % NUM_VOXEL_COLS;
            if (row < 0 || col < 0 || row >= NUM_VOXEL_ROWS || col >= NUM_VOXEL_COLS)
                throw new Error(`Decoded voxel coordinates are out of range (row = ${row}, col = ${col})`);
            const voxel = Voxel.decodeWithParams(bufferState, quadsMem, row, col) as Voxel;
            voxels[voxelIndex++] = voxel;
        }
        return new VoxelGrid(voxels, quadsMem);
    }
}