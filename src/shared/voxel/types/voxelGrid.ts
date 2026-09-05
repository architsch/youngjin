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

    // The stretches of the room only a superuser may edit (see @docs/gameplay/restricted_zone.md).
    //
    // They are kept here, alongside the voxels, because that is what they are about: a zone is a
    // region of this grid, and the two are read, written and sent as one. A room arriving at a
    // client therefore arrives with its zones already on it, and nothing has to remember to carry
    // them separately.
    restrictedZones: RestrictedZone[];

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
                // All collisionLayers are initially occupied (i.e. all voxel blocks are initially full of solid matter).
                // They will then be "carved out" by the room generation algorithm.
                voxels[row * NUM_VOXEL_COLS + col] = new Voxel(quadsMem, row, col, FULL_COLLISION_LAYER_MASK);
            }
        }
        // A room is born with no restricted zones. That is generation's decision rather than an
        // omission: a zone is a judgement about which stretch of one particular room its owner means
        // to keep to himself, and there is nothing generation could draw that would be that
        // judgement. Rooms that should come out already holding one would be told so through
        // RoomBuilderParams, the way every other room-level parameter is
        // (see @docs/geometry/room_generation.md).
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

        // Add corner walls. They are raised only as high as a room of that era stood, since the
        // conversion that follows this one is what carries the whole room up to its present height.
        addLegacyCornerWall(voxels, 0, 0, quadTextureIndicesWithinLayer);
        addLegacyCornerWall(voxels, 0, NUM_VOXEL_COLS-1, quadTextureIndicesWithinLayer);
        addLegacyCornerWall(voxels, NUM_VOXEL_ROWS-1, 0, quadTextureIndicesWithinLayer);
        addLegacyCornerWall(voxels, NUM_VOXEL_ROWS-1, NUM_VOXEL_COLS-1, quadTextureIndicesWithinLayer);

        // Hollow out the entrance cell to the doorway's height, so that an arriving player does not
        // spawn inside the boundary wall. A room being converted is already built, so this takes
        // the blocks back out rather than declaring the space they were never put in.
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
            //
            // The height that tile hung at is a fact about the format being migrated from, so it is
            // taken from the old format's own height rather than from where a room built today
            // happens to put its storey floor. Those two were once the same number, and a migration
            // written against the second would quietly start laying this slab through the top of
            // every legacy room the day that number moved.
            VoxelUpdateUtil.addVoxelBlock(undefined, voxelGrid.voxels,
                VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col,
                    LEGACY_NUM_COLLISION_LAYERS),
                new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(ceilingTextureIndex));

            // The room's own ceiling now hangs over the empty storey left above that slab, where
            // nothing stands against it, so every cell of it is on show — including the cells that
            // a wall reaching the old ceiling used to cover.
            VoxelQuadUpdateUtil.setVoxelQuadVisible(true, voxel, "y", "-", COLLISION_LAYER_NULL,
                ceilingTextureIndex);
        }
        return voxelGrid;
    },
    (olderVersionData: EncodableData) => { // version 2 -> 3
        // The doorway is filled back in. A door is an ordinary wall attachment now, hung on the
        // boundary wall like a picture is, and a wall attachment needs the wall behind it — so the
        // hole the entrance used to be is exactly what a door may no longer be hung over. This is
        // the counterpart of the v0 -> v1 conversion, which is what cut the hole in the first place.
        //
        // The blocks are finished in whatever the wall beside them is finished in, so that the
        // filled cell reads as the stretch of wall it now is rather than as a patch.
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
        // Rooms gained restricted zones, and a room written before they existed had none. There is
        // nothing to work out here: a zone says which part of a room its owner meant to keep to
        // himself, and a room from before the question was asked has not answered it. Leaving the
        // list empty is that answer, and it leaves every such room editable exactly as it was.
        return olderVersionData;
    },
];

// What the wall next to the given cell is finished in, layer for layer. The entrance is cut through
// a boundary wall, so the cells to either side of it along that wall are solid and carry the finish
// the filled cell should take. Falls back to the first texture if neither neighbour is there to ask.
function getNeighbouringWallTextureIndices(voxelGrid: VoxelGrid, row: number, col: number,
    collisionLayer: number): number[]
{
    const quads = voxelGrid.quadsMem.quads;
    // Along the boundary wall the entrance is cut through, which is a row when the wall runs east to
    // west and a column when it runs north to south. The entrance sits on a row of the grid's edge,
    // so its neighbours along the wall are the cells either side of it in that same row.
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

// The current format: every voxel reads itself off the buffer, and the room's restricted zones
// follow them.
function decoder_3(bufferState: BufferState): EncodableData
{
    const voxelGrid = decoder_2(bufferState) as VoxelGrid;
    voxelGrid.restrictedZones = decodeRestrictedZones(bufferState);
    return voxelGrid;
}

// The format as it stood before a room carried its restricted zones: every voxel reads itself off
// the buffer, and there is nothing behind them.
function decoder_2(bufferState: BufferState): EncodableData
{
    return decodeVoxels(bufferState,
        (bs, quadsMem, row, col) => Voxel.decodeWithParams(bs, quadsMem, row, col) as Voxel);
}

function encodeRestrictedZones(bufferState: BufferState, restrictedZones: RestrictedZone[]): void
{
    // Capped rather than trusted: the count is written in a single byte, and everything that reaches
    // here has already been through the validation that enforces the cap, so a list longer than it
    // means something upstream went wrong and must not be allowed to write a count it cannot read
    // back.
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
