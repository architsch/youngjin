import Voxel from "./voxel";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"
import { COLLISION_LAYER_NULL, FULL_COLLISION_LAYER_MASK, MAX_RESTRICTED_ZONES, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import VoxelQuadsRuntimeMemory from "./voxelQuadsRuntimeMemory";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import VoxelQueryUtil from "../util/voxelQueryUtil";
import VoxelQuadUpdateUtil from "../util/voxelQuadUpdateUtil";
import { RoomVolumeConstructorMap } from "../../room/generation/maps/roomVolumeConstructorMap";
import VoxelUpdateUtil from "../util/voxelUpdateUtil";
import RestrictedZone from "./restrictedZone";

const latestVersion = 4;

// Layer count of the previous half-height format. Its layers map onto the current lowest ones; the
// upper half arrives empty.
const LEGACY_NUM_COLLISION_LAYERS = 8;
const LEGACY_COLLISION_LAYER_MAX = LEGACY_NUM_COLLISION_LAYERS - 1;

export default class VoxelGrid extends EncodableData
{
    voxels: Voxel[];
    quadsMem: VoxelQuadsRuntimeMemory; // This field is NOT part of the encoded data.

    // Restricted zones (see @docs/gameplay/restricted_zone.md), stored and sent with the voxels.
    restrictedZones: RestrictedZone[];

    // Format version this grid was read from (current if generated); not encoded. Also dates the objects
    // stored in the same blob (see ObjectGroup's converters).
    sourceFormatVersion: number;

    constructor(voxels: Voxel[], quadsMem: VoxelQuadsRuntimeMemory,
        sourceFormatVersion: number = latestVersion,
        restrictedZones: RestrictedZone[] = [])
    {
        super();
        this.voxels = voxels;
        this.quadsMem = quadsMem;
        this.sourceFormatVersion = sourceFormatVersion;
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
        if (versionFound < latestVersion)
        {
            let data = olderVersionDecoders[versionFound](bufferState);
            for (let version = versionFound; version < latestVersion; ++version)
                data = versionConverters[version](data);
            (data as VoxelGrid).sourceFormatVersion = versionFound;
            return data;
        }
        const voxelGrid = decoder_3(bufferState) as VoxelGrid;
        voxelGrid.sourceFormatVersion = versionFound;
        return voxelGrid;
    }
}

const olderVersionDecoders: ((bufferState: BufferState) => EncodableData)[] = [
    decoder_1, // version 0 (same binary layout as version 1)
    decoder_1, // version 1
    decoder_2, // version 2
    decoder_2, // version 3 (same binary layout as version 2)
    decoder_3, // version 4
];

const versionConverters: ((olderVersionData: EncodableData) => EncodableData)[] = [
    (olderVersionData: EncodableData) => { // version 0 -> 1
        const voxelGrid = olderVersionData as VoxelGrid;
        const voxels = voxelGrid.voxels;
        const quadTextureIndicesWithinLayer = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(0);

        // Corner walls, at the legacy room height (the next conversion raises the room).
        addLegacyCornerWall(voxels, 0, 0, quadTextureIndicesWithinLayer);
        addLegacyCornerWall(voxels, 0, NUM_VOXEL_COLS-1, quadTextureIndicesWithinLayer);
        addLegacyCornerWall(voxels, NUM_VOXEL_ROWS-1, 0, quadTextureIndicesWithinLayer);
        addLegacyCornerWall(voxels, NUM_VOXEL_ROWS-1, NUM_VOXEL_COLS-1, quadTextureIndicesWithinLayer);

        // Hollow the legacy entrance doorway so arriving players don't spawn inside the wall.
        const entrance = RoomVolumeConstructorMap["InitialMultiplayerEntrance"]();
        for (let row = entrance.rowMin; row <= entrance.rowMax; ++row)
        {
            for (let col = entrance.colMin; col <= entrance.colMax; ++col)
            {
                for (let collisionLayer = entrance.collisionLayerMin; collisionLayer <= entrance.collisionLayerMax; ++collisionLayer)
                {
                    VoxelUpdateUtil.removeVoxelBlock(undefined, voxels,
                        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer));
                }
            }
        }
        return voxelGrid;
    },
    (olderVersionData: EncodableData) => { // version 1 -> 2
        // The room height doubled: existing contents stay in place (same floor, same layer height);
        // only the cap overhead changes.
        const voxelGrid = olderVersionData as VoxelGrid;
        const quads = voxelGrid.quadsMem.quads;

        for (const voxel of voxelGrid.voxels)
        {
            const ceilingTextureIndex =
                quads[VoxelQueryUtil.getCeilingVoxelQuadIndex(voxel.row, voxel.col)] & 0b01111111;

            // The old flat ceiling becomes a real slab at the height it used to hang, textured with the
            // old ceiling texture, so the room below looks unchanged. The height is taken from the old
            // format, not from today's storey floor, so the migration can't drift if that changes.
            VoxelUpdateUtil.addVoxelBlock(undefined, voxelGrid.voxels,
                VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col,
                    LEGACY_NUM_COLLISION_LAYERS),
                new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(ceilingTextureIndex));

            // The room's ceiling now covers an empty storey, so every ceiling cell is visible.
            VoxelQuadUpdateUtil.setVoxelQuadVisible(true, voxel, "y", "-", COLLISION_LAYER_NULL,
                ceilingTextureIndex);
        }
        return voxelGrid;
    },
    (olderVersionData: EncodableData) => { // version 2 -> 3
        // Fill the old entrance doorway back in (doors are wall attachments and need the wall), using
        // the neighbouring wall's textures. Reverses the v0 -> v1 hole.
        const voxelGrid = olderVersionData as VoxelGrid;
        const entrance = RoomVolumeConstructorMap["InitialMultiplayerEntrance"]();

        for (let row = entrance.rowMin; row <= entrance.rowMax; ++row)
        {
            for (let col = entrance.colMin; col <= entrance.colMax; ++col)
            {
                for (let collisionLayer = entrance.collisionLayerMin; collisionLayer <= entrance.collisionLayerMax; ++collisionLayer)
                {
                    VoxelUpdateUtil.addVoxelBlock(undefined, voxelGrid.voxels,
                        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer),
                        getNeighbouringWallTextureIndices(voxelGrid, row, col, collisionLayer));
                }
            }
        }
        return voxelGrid;
    },
    (olderVersionData: EncodableData) => { // version 3 -> 4
        // Restricted zones added; older rooms get none.
        return olderVersionData;
    },
];

// Texture indices of the wall beside the given cell (falls back to the first texture).
function getNeighbouringWallTextureIndices(voxelGrid: VoxelGrid, row: number, col: number,
    collisionLayer: number): number[]
{
    const quads = voxelGrid.quadsMem.quads;
    // The entrance is on an edge row, so its wall neighbours are the cells to either side in that row.
    const neighbours = [{row, col: col - 1}, {row, col: col + 1}];
    for (const neighbour of neighbours)
    {
        const voxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels, neighbour.row, neighbour.col);
        if (!voxel || !VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer))
            continue;

        const textureIndices = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(
            neighbour.row, neighbour.col, collisionLayer);
        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            textureIndices[i] = quads[startIndex + i] & 0b01111111;
        return textureIndices;
    }
    return new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(0);
}

function addLegacyCornerWall(voxels: Voxel[], row: number, col: number,
    quadTextureIndicesWithinLayer: number[]): void
{
    for (let collisionLayer = 0; collisionLayer <= LEGACY_COLLISION_LAYER_MAX; ++collisionLayer)
    {
        VoxelUpdateUtil.addVoxelBlock(undefined, voxels,
            VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer),
            quadTextureIndicesWithinLayer);
    }
}

// Current format: voxels, then restricted zones.
function decoder_3(bufferState: BufferState): EncodableData
{
    const voxelGrid = decoder_2(bufferState) as VoxelGrid;
    voxelGrid.restrictedZones = decodeRestrictedZones(bufferState);
    return voxelGrid;
}

// Previous format: voxels only.
function decoder_2(bufferState: BufferState): EncodableData
{
    return decodeVoxels(bufferState,
        (bs, quadsMem, row, col) => Voxel.decodeWithParams(bs, quadsMem, row, col) as Voxel);
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

// Half-height format: one mask byte and 8 layers, decoded into current quad memory with an empty upper half.
function decoder_1(bufferState: BufferState): EncodableData
{
    return decodeVoxels(bufferState, decodeLegacyVoxel);
}

function decodeVoxels(bufferState: BufferState, decodeVoxel: (bufferState: BufferState,
    quadsMem: VoxelQuadsRuntimeMemory, row: number, col: number) => Voxel): EncodableData
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
        voxels[voxelIndex++] = decodeVoxel(bufferState, quadsMem, row, col);
    }
    return new VoxelGrid(voxels, quadsMem);
}

function decodeLegacyVoxel(bufferState: BufferState, quadsMem: VoxelQuadsRuntimeMemory,
    row: number, col: number): Voxel
{
    const quads = quadsMem.quads;

    quads[VoxelQueryUtil.getCeilingVoxelQuadIndex(row, col)] = bufferState.view[bufferState.byteIndex++];
    quads[VoxelQueryUtil.getFloorVoxelQuadIndex(row, col)] = bufferState.view[bufferState.byteIndex++];

    const collisionLayerMask = bufferState.view[bufferState.byteIndex++]; // one byte, hence eight layers

    for (let collisionLayer = 0; collisionLayer <= LEGACY_COLLISION_LAYER_MAX; ++collisionLayer)
    {
        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
        const layerIsOccupied = ((1 << collisionLayer) & collisionLayerMask) != 0;
        for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            quads[i] = layerIsOccupied ? bufferState.view[bufferState.byteIndex++] : 0;
    }
    // Upper layers stay empty (freshly allocated memory).
    return new Voxel(quadsMem, row, col, collisionLayerMask);
}
