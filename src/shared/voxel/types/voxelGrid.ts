import Voxel from "./voxel";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"

export default class VoxelGrid extends EncodableData
{
    numGridRows: number;
    numGridCols: number;
    voxels: Voxel[];

    constructor(numGridRows: number, numGridCols: number, voxels: Voxel[])
    {
        super();
        this.numGridRows = numGridRows;
        this.numGridCols = numGridCols;
        this.voxels = voxels;
    }

    encode(bufferState: BufferState)
    {
        bufferState.view[bufferState.byteIndex++] = this.numGridRows;
        bufferState.view[bufferState.byteIndex++] = this.numGridCols;
        for (const voxel of this.voxels)
            voxel.encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const numGridRows = bufferState.view[bufferState.byteIndex++];
        const numGridCols = bufferState.view[bufferState.byteIndex++];
        const numVoxels = numGridRows * numGridCols;
        const voxels = new Array<Voxel>(numVoxels);
        voxels.length = 0;

        const numGridColsInv = 1 / numGridCols;
        let voxelIndex = 0;

        while (voxelIndex < numVoxels)
        {
            const row = Math.floor(voxelIndex * numGridColsInv);
            const col = voxelIndex % numGridCols;
            if (row < 0 || col < 0 || row >= numGridRows || col >= numGridCols)
                throw new Error(`Decoded voxel coordinates are out of range (row = ${row}, col = ${col}, numGridRows = ${numGridRows}, numGridCols = ${numGridCols})`);
            const voxel = Voxel.decode(bufferState) as Voxel;
            voxel.setCoordinates(row, col);
            voxels[voxelIndex++] = voxel;
        }
        return new VoxelGrid(numGridRows, numGridCols, voxels);
    }
}