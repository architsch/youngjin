import Voxel from "./voxel";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"
import { MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import VoxelQuadsRuntimeMemory from "./voxelQuadsRuntimeMemory";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import RoomGenerationHelperUtil from "../../room/util/roomGenerationHelperUtil";

const latestVersion = 1;

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
        return decoder_0(bufferState);
    }
}

const olderVersionDecoders: ((bufferState: BufferState) => EncodableData)[] = [
    decoder_0, // version 0
    decoder_0, // version 1
];

const versionConverters: ((olderVersionData: EncodableData) => EncodableData)[] = [
    (olderVersionData: EncodableData) => { // version 0 -> 1
        const voxelGrid = olderVersionData as VoxelGrid;
        const voxels = voxelGrid.voxels;
        const quadTextureIndicesWithinLayer = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(0);

        // Add corner walls
        RoomGenerationHelperUtil.addWall(voxels, 0, 0, quadTextureIndicesWithinLayer);
        RoomGenerationHelperUtil.addWall(voxels,0, NUM_VOXEL_COLS-1, quadTextureIndicesWithinLayer);
        RoomGenerationHelperUtil.addWall(voxels, NUM_VOXEL_ROWS-1, 0, quadTextureIndicesWithinLayer);
        RoomGenerationHelperUtil.addWall(voxels, NUM_VOXEL_ROWS-1, NUM_VOXEL_COLS-1, quadTextureIndicesWithinLayer);

        // Make the player's entrance point (i.e. behind the entrance door) hollow, so as to prevent the player from experiencing collision on entrance.
        RoomGenerationHelperUtil.removeWall(voxels, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, MULTI_PLAYER_ENTRANCE_VOXEL_COL, 0, 4);

        return voxelGrid;
    },
];

function decoder_0(bufferState: BufferState): EncodableData
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