import Voxel from "./voxel";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"
import { FULL_COLLISION_LAYER_MASK, MAX_RESTRICTED_ZONES, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import VoxelQuadsRuntimeMemory from "./voxelQuadsRuntimeMemory";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import RestrictedZone from "./restrictedZone";
import VoxelGridVersionMigration from "../versionMigration/voxelGridVersionMigration";

const latestVersion = 4;

export default class VoxelGrid extends EncodableData
{
    voxels: Voxel[];
    quadsMem: VoxelQuadsRuntimeMemory; // This field is NOT part of the encoded data.

    // Restricted zones (see @docs/gameplay/restricted_zone.md), stored and sent with the voxels.
    restrictedZones: RestrictedZone[];

    // Format version this grid was read from (current if generated); not encoded. Also dates the objects
    // stored in the same blob (see ObjectGroupVersionMigration).
    sourceFormatVersion: number = latestVersion;

    constructor(voxels: Voxel[], quadsMem: VoxelQuadsRuntimeMemory,
        restrictedZones: RestrictedZone[] = [])
    {
        super();
        this.voxels = voxels;
        this.quadsMem = quadsMem;
        this.restrictedZones = restrictedZones;
    }

    // The version a grid encoded right now is written at, which is what an unread grid reports.
    static get latestFormatVersion(): number { return latestVersion; }

    static createBaseGrid(): VoxelGrid
    {
        const voxels = new Array<Voxel>(NUM_VOXEL_ROWS * NUM_VOXEL_COLS);
        const quadsMem = new VoxelQuadsRuntimeMemory();
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                // Start fully solid; generation carves the room out.
                voxels[row * NUM_VOXEL_COLS + col] = new Voxel(quadsMem, row, col, FULL_COLLISION_LAYER_MASK);
            }
        }
        // No zones: a zone is a per-room owner decision generation can't make (see
        // @docs/geometry/room_generation.md).
        return new VoxelGrid(voxels, quadsMem);
    }

    encode(bufferState: BufferState)
    {
        new EncodableRawByteNumber(latestVersion).encode(bufferState);

        for (const voxel of this.voxels)
            voxel.encode(bufferState);

        encodeRestrictedZones(bufferState, this.restrictedZones);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const versionFound = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const voxelGrid = new VoxelGrid([], new VoxelQuadsRuntimeMemory());
        if (versionFound < latestVersion)
            VoxelGridVersionMigration.decode(bufferState, voxelGrid, versionFound, latestVersion);
        else
            decodeBody(bufferState, voxelGrid);
        voxelGrid.sourceFormatVersion = versionFound;
        return voxelGrid;
    }
}

// Current format: voxels, then restricted zones.
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
    voxelGrid.restrictedZones = decodeRestrictedZones(bufferState);
}

function encodeRestrictedZones(bufferState: BufferState, restrictedZones: RestrictedZone[]): void
{
        // Capped (single-byte count); an over-long list here means an upstream validation bug.
    const numZones = Math.min(restrictedZones.length, MAX_RESTRICTED_ZONES);
    if (restrictedZones.length > MAX_RESTRICTED_ZONES)
    {
        console.error(`VoxelGrid :: Too many restricted zones to encode ` +
            `(${restrictedZones.length}, max ${MAX_RESTRICTED_ZONES})`);
    }
    new EncodableRawByteNumber(numZones).encode(bufferState);
    for (let i = 0; i < numZones; ++i)
        restrictedZones[i].encode(bufferState);
}

function decodeRestrictedZones(bufferState: BufferState): RestrictedZone[]
{
    const numZones = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
    if (numZones > MAX_RESTRICTED_ZONES)
        throw new Error(`Decoded restricted zone count is out of range (numZones = ${numZones})`);

    const restrictedZones = new Array<RestrictedZone>(numZones);
    for (let i = 0; i < numZones; ++i)
        restrictedZones[i] = RestrictedZone.decode(bufferState) as RestrictedZone;
    return restrictedZones;
}
