import Voxel from "./voxel";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"
import { NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import VoxelQuadsRuntimeMemory from "./voxelQuadsRuntimeMemory";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";

const latestVersion = 0;

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
        new EncodableRawByteNumber(latestVersion).encode(bufferState);

        for (const voxel of this.voxels)
            voxel.encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const versionFound = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        if (versionFound < latestVersion)
        {
            let data = olderVersionDecoders[versionFound](bufferState);
            for (let version = versionFound; version < latestVersion; ++version)
                data = versionConverters[version](data);
            return data;
        }

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

const olderVersionDecoders: ((bufferState: BufferState) => EncodableData)[] = [
    (bufferState: BufferState) => { // version 0
        return new VoxelGrid([], new VoxelQuadsRuntimeMemory()); // This is just a placeholder
    },
];

const versionConverters: ((olderVersionData: EncodableData) => EncodableData)[] = [
    (olderVersionData: EncodableData) => { // version 0 -> 1
        return new VoxelGrid([], new VoxelQuadsRuntimeMemory()); // This is just a placeholder
    },
];
