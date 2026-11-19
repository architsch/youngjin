import Voxel from "./voxel";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"
import { NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import VoxelQuadsRuntimeMemory from "./voxelQuadsRuntimeMemory";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import LegacyRestrictedZone from "../versionMigration/legacyRestrictedZone";
import VoxelGridVersionMigration from "../versionMigration/voxelGridVersionMigration";

const latestVersion = 8;

// A voxel's mask when every one of its layers holds a block (see Voxel.blockLayerMask).
const FULL_BLOCK_LAYER_MASK = (1 << NUM_COLLISION_LAYERS) - 1;

export default class VoxelGrid extends EncodableData
{
    voxels: Voxel[];
    quadsMem: VoxelQuadsRuntimeMemory; // This field is NOT part of the encoded data.

    // Format version this grid was read from (current if generated); not encoded. Also dates the objects
    // stored in the same blob (see ObjectGroupVersionMigration).
    sourceFormatVersion: number = latestVersion;

    // The restricted zones an older version kept here, in voxels; not encoded. The objects read from the same
    // blob take them over as volumes (see ObjectGroupVersionMigration).
    legacyRestrictedZones: LegacyRestrictedZone[] = [];

    constructor(voxels: Voxel[], quadsMem: VoxelQuadsRuntimeMemory)
    {
        super();
        this.voxels = voxels;
        this.quadsMem = quadsMem;
    }

    // The version a grid encoded right now is written at, which is what an unread grid reports.
    static get latestFormatVersion(): number { return latestVersion; }

    static createBaseGrid(): VoxelGrid
    {
        const voxels = new Array<Voxel>(NUM_VOXEL_ROWS * NUM_VOXEL_COLS);
        const quadsMem = new VoxelQuadsRuntimeMemory();
        // Start fully solid; generation carves the room out.
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
                voxels[row * NUM_VOXEL_COLS + col] = new Voxel(quadsMem, row, col, FULL_BLOCK_LAYER_MASK);
        }
        return new VoxelGrid(voxels, quadsMem);
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
        const voxelGrid = new VoxelGrid([], new VoxelQuadsRuntimeMemory());
        if (versionFound < latestVersion)
            VoxelGridVersionMigration.decode(bufferState, voxelGrid, versionFound);
        else
            decodeBody(bufferState, voxelGrid);
        voxelGrid.sourceFormatVersion = versionFound;
        return voxelGrid;
    }
}

// Current format: the voxels, row by row.
function decodeBody(bufferState: BufferState, voxelGrid: VoxelGrid): void
{
    for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
    {
        for (let col = 0; col < NUM_VOXEL_COLS; ++col)
        {
            voxelGrid.voxels[row * NUM_VOXEL_COLS + col] =
                Voxel.decodeWithParams(bufferState, voxelGrid.quadsMem, row, col) as Voxel;
        }
    }
}
