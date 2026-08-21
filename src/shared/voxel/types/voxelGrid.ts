import Voxel from "./voxel";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"
import { COLLISION_LAYER_NULL, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER } from "../../system/sharedConstants";
import VoxelQuadsRuntimeMemory from "./voxelQuadsRuntimeMemory";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import RoomGenerationHelperUtil from "../../room/util/roomGenerationHelperUtil";
import RoomGenerationVolumeUtil from "../../room/util/roomGenerationVolumeUtil";
import VoxelQueryUtil from "../util/voxelQueryUtil";
import VoxelQuadUpdateUtil from "../util/voxelQuadUpdateUtil";

const latestVersion = 2;

// How tall a room stood in the format that came before the current one: half its present height,
// with its ceiling hanging flat over the top of it. Its layers cover the same world heights the
// current format's lowest ones do, so a legacy voxel's contents move across unchanged and
// everything above them arrives empty.
const LEGACY_NUM_COLLISION_LAYERS = 8;
const LEGACY_COLLISION_LAYER_MAX = LEGACY_NUM_COLLISION_LAYERS - 1;

export default class VoxelGrid extends EncodableData
{
    voxels: Voxel[];
    quadsMem: VoxelQuadsRuntimeMemory; // This field is NOT part of the encoded data.

    // Which version of the format this grid was read from, or the current one for a grid that was
    // generated rather than read. Not part of the encoded data — it describes where the grid came
    // from, not what it holds.
    //
    // It is here because a room's voxel grid and its objects are written together, as one blob, so
    // this is also the version *the objects alongside it* were written at. ObjectGroup carries no
    // usable version of its own for that era (see the note on its converters), and this is the only
    // record of it that survives.
    sourceFormatVersion: number;

    constructor(voxels: Voxel[], quadsMem: VoxelQuadsRuntimeMemory,
        sourceFormatVersion: number = latestVersion)
    {
        super();
        this.voxels = voxels;
        this.quadsMem = quadsMem;
        this.sourceFormatVersion = sourceFormatVersion;
    }

    // The version a grid encoded right now is written at, which is what an unread grid reports.
    static get latestFormatVersion(): number { return latestVersion; }

    // The blank slate every room generation routine starts from: a full grid of voxels with
    // nothing built in any of them yet.
    static createEmpty(): VoxelGrid
    {
        const voxels = new Array<Voxel>(NUM_VOXEL_ROWS * NUM_VOXEL_COLS);
        const quadsMem = new VoxelQuadsRuntimeMemory();
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                voxels[row * NUM_VOXEL_COLS + col] = new Voxel(quadsMem, row, col, 0);
            }
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
        if (versionFound < latestVersion)
        {
            let data = olderVersionDecoders[versionFound](bufferState);
            for (let version = versionFound; version < latestVersion; ++version)
                data = versionConverters[version](data);
            (data as VoxelGrid).sourceFormatVersion = versionFound;
            return data;
        }
        const voxelGrid = decoder_2(bufferState) as VoxelGrid;
        voxelGrid.sourceFormatVersion = versionFound;
        return voxelGrid;
    }
}

const olderVersionDecoders: ((bufferState: BufferState) => EncodableData)[] = [
    decoder_1, // version 0 (same binary layout as version 1)
    decoder_1, // version 1
    decoder_2, // version 2
];

const versionConverters: ((olderVersionData: EncodableData) => EncodableData)[] = [
    (olderVersionData: EncodableData) => { // version 0 -> 1
        const voxelGrid = olderVersionData as VoxelGrid;
        const voxels = voxelGrid.voxels;
        const quadTextureIndicesWithinLayer = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(0);

        // Add corner walls. They are raised only as high as a room of that era stood, since the
        // conversion that follows this one is what carries the whole room up to its present height.
        addLegacyCornerWall(voxels, 0, 0, quadTextureIndicesWithinLayer);
        addLegacyCornerWall(voxels, 0, NUM_VOXEL_COLS-1, quadTextureIndicesWithinLayer);
        addLegacyCornerWall(voxels, NUM_VOXEL_ROWS-1, 0, quadTextureIndicesWithinLayer);
        addLegacyCornerWall(voxels, NUM_VOXEL_ROWS-1, NUM_VOXEL_COLS-1, quadTextureIndicesWithinLayer);

        // Hollow out the entrance cell to the doorway's height, so that an arriving player does not
        // spawn inside the boundary wall. A room being converted is already built, so this takes
        // the blocks back out rather than declaring the space they were never put in.
        const entrance = RoomGenerationVolumeUtil.MULTI_PLAYER_ENTRANCE;
        RoomGenerationHelperUtil.removeWall(voxels, entrance.rowStart, entrance.colStart,
            entrance.collisionLayerStart, RoomGenerationVolumeUtil.getCollisionLayerMax(entrance));

        return voxelGrid;
    },
    (olderVersionData: EncodableData) => { // version 1 -> 2
        // The room's height doubled, so a room built to the old one has to be told where its old
        // top now lies. Everything the room already held stays exactly where it stood — the two
        // formats measure their layers from the same floor, in layers of the same height — and
        // what changes is only what closes the room off overhead.
        const voxelGrid = olderVersionData as VoxelGrid;
        const quads = voxelGrid.quadsMem.quads;

        for (const voxel of voxelGrid.voxels)
        {
            const ceilingTextureIndex =
                quads[VoxelQueryUtil.getCeilingVoxelQuadIndex(voxel.row, voxel.col)] & 0b01111111;

            // What used to be the flat ceiling tile becomes a storey floor: a slab of real blocks
            // laid at the height that tile hung at, so the room below it is left looking exactly as
            // it did. Every face of the slab carries the old ceiling texture — its sides never come
            // into view (the slab is unbroken across the room, so it only ever meets itself), and
            // neither does its top until an owner opens up the storey above.
            RoomGenerationHelperUtil.addWall(voxelGrid.voxels, voxel.row, voxel.col,
                new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(ceilingTextureIndex),
                STOREY_FLOOR_COLLISION_LAYER, STOREY_FLOOR_COLLISION_LAYER);

            // The room's own ceiling now hangs over the empty storey left above that slab, where
            // nothing stands against it, so every cell of it is on show — including the cells that
            // a wall reaching the old ceiling used to cover.
            VoxelQuadUpdateUtil.setVoxelQuadVisible(true, voxel, "y", "-", COLLISION_LAYER_NULL,
                ceilingTextureIndex);
        }
        return voxelGrid;
    },
];

function addLegacyCornerWall(voxels: Voxel[], row: number, col: number,
    quadTextureIndicesWithinLayer: number[]): void
{
    RoomGenerationHelperUtil.addWall(voxels, row, col, quadTextureIndicesWithinLayer,
        0, LEGACY_COLLISION_LAYER_MAX);
}

// The current format: every voxel reads itself off the buffer.
function decoder_2(bufferState: BufferState): EncodableData
{
    return decodeVoxels(bufferState,
        (bs, quadsMem, row, col) => Voxel.decodeWithParams(bs, quadsMem, row, col) as Voxel);
}

// The format as it stood while a room was half its present height: one byte of collision layer
// mask rather than two, and eight layers behind it rather than sixteen. Everything it reads is
// written into the present-day quad memory, so what comes out is an ordinary voxel with an empty
// upper half — which the converter above then finishes.
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
    // The layers above the legacy room's height arrive empty, which the freshly allocated quad
    // memory already holds them as.
    return new Voxel(quadsMem, row, col, collisionLayerMask);
}
