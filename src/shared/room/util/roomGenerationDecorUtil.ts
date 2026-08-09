import ImageMapUtil from "../../graphics/image/util/imageMapUtil";
import RandomNumberGenerator from "../../math/types/randomNumberGenerator";
import Vec3 from "../../math/types/vec3";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../object/types/addObjectSignal";
import ObjectGroup from "../../object/types/objectGroup";
import { ObjectMetadataKeyEnumMap } from "../../object/types/objectMetadataKey";
import ObjectTransform from "../../object/types/objectTransform";
import EncodableByteString from "../../networking/types/encodableByteString";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, DIR_VEC_BY_NAME, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import Voxel from "../../voxel/types/voxel";
import VoxelGrid from "../../voxel/types/voxelGrid";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import RoomGenerationPalette from "../types/roomGeneration/roomGenerationPalette";
import RoomGenerationRect from "../types/roomGeneration/roomGenerationRect";
import RoomGenerationRegion from "../types/roomGeneration/roomGenerationRegion";
import RoomGenerationHelperUtil from "./roomGenerationHelperUtil";

// Furnishes a room whose floor plan is already built: decorative block work standing inside its
// regions, and paintings hung on its walls. Everything here works off the finished voxel grid,
// so it is equally usable on a room being generated from scratch and on one being redecorated.

const PROP_MARGIN = 2; // cells left clear between a region's edge and anything standing inside it
const PILLAR_SPACING = 4;
const HALF_HEIGHT_PILLAR_TOP_LAYER = COLLISION_LAYER_MIN + 3;
const PLINTH_TOP_LAYER = COLLISION_LAYER_MIN + 1; // waist height: reads as a display stand, and never blocks the view across a room
const CENTREPIECE_MIN_REGION_SIZE = 4; // below this the centrepiece shrinks to a single cell

// The collision layers a painting's lower edge may sit on. A painting is one cell tall, so it
// covers this layer and the one above it — both well within a standing player's eyeline.
const CANVAS_BOTTOM_LAYERS = [2, 3];
const MIN_CANVAS_GAP = 3; // in cells, between two paintings hung on the same wall face

const MOUNTING_DIR_NAMES = ["-x", "+x", "-z", "+z"];

// The collision layer mask of a cell that is solid from the room's floor to its ceiling.
const FULL_HEIGHT_COLLISION_LAYER_MASK = (() => {
    let mask = 0;
    for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
        mask |= (1 << collisionLayer);
    return mask;
})();

const RoomGenerationDecorUtil =
{
    // Stands one arrangement of decorative blocks inside a region, chosen by the seed. Some
    // regions are deliberately left bare, so that a generated room has open space in it as well
    // as furnished space.
    addProps: (voxelGrid: VoxelGrid, region: RoomGenerationRegion,
        keepClearRects: RoomGenerationRect[], rand: RandomNumberGenerator): void =>
    {
        const inner = RoomGenerationHelperUtil.insetRect(region.rect, PROP_MARGIN);
        if (inner.numRows < 1 || inner.numCols < 1)
            return; // The region is too small to hold anything without crowding its doorways.

        switch (rand.randomInt(0, 4))
        {
            case 0: addColonnade(voxelGrid, inner, region.palette, keepClearRects, rand); break;
            case 1: addCentrepiece(voxelGrid, inner, region.palette, keepClearRects); break;
            case 2: addCornerBlocks(voxelGrid, inner, region.palette, keepClearRects); break;
            default: break; // left bare
        }
    },

    // Hangs paintings across the room, on whichever wall faces can take one, and returns how
    // many went up. Candidates are visited in a seeded random order and spaced out along each
    // wall, so the paintings end up scattered over the whole room rather than tiled along the
    // first wall that fits them.
    hangCanvases: (voxelGrid: VoxelGrid, objectGroup: ObjectGroup, maxCount: number,
        keepClearRects: RoomGenerationRect[], rand: RandomNumberGenerator): number =>
    {
        const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
        const images = ImageMapUtil.getImageMap("CanvasImageMap").getImageMetadataList();
        const frames = ImageMapUtil.getImageMap("CanvasFrameImageMap").getImageMetadataList();

        const mountings = shuffle(collectMountings(voxelGrid, keepClearRects), rand);
        const hung: Mounting[] = [];

        for (const mounting of mountings)
        {
            if (hung.length >= maxCount)
                break;
            if (hung.some(other => other.dirName == mounting.dirName &&
                Math.abs(other.row - mounting.row) + Math.abs(other.col - mounting.col) < MIN_CANVAS_GAP))
            {
                continue;
            }

            const bottomLayer = CANVAS_BOTTOM_LAYERS[rand.randomInt(0, CANVAS_BOTTOM_LAYERS.length)];
            if (!canHangAt(voxelGrid, mounting, bottomLayer))
                continue;

            // A wall-attached object sits on the boundary plane between the wall cell backing it
            // and the open cell in front, facing away from the wall.
            const dir = mounting.dir;
            const pos: Vec3 = {
                x: mounting.col + 0.5 + 0.5 * dir.x,
                y: 0.5 * (bottomLayer + 1),
                z: mounting.row + 0.5 + 0.5 * dir.z,
            };

            // The room itself owns what it was generated with, so these carry no source user,
            // the same way a generated room's other fixtures do. The room ID is left blank too,
            // since it is stamped on when the room is decoded (see ObjectGroup.decodeWithParams).
            const objectId = getCanvasObjectId(mounting);
            objectGroup.objectById[objectId] = new AddObjectSignal(
                "", "", "", canvasTypeIndex, objectId,
                new ObjectTransform(pos, {x: dir.x, y: 0, z: dir.z}),
                {
                    [ObjectMetadataKeyEnumMap.ImagePath]:
                        new EncodableByteString(images[rand.randomInt(0, images.length)].path),
                    [ObjectMetadataKeyEnumMap.CanvasFrameCoords]:
                        new EncodableByteString(frames[rand.randomInt(0, frames.length)].path),
                });
            hung.push(mounting);
        }
        return hung.length;
    },
}

// A wall face a painting could be hung on: the wall cell backing it, and the direction the
// painting would face (i.e. out of that cell, into the open).
interface Mounting
{
    row: number;
    col: number;
    dirName: string;
    dir: Vec3;
}

function addColonnade(voxelGrid: VoxelGrid, inner: RoomGenerationRect, palette: RoomGenerationPalette,
    keepClearRects: RoomGenerationRect[], rand: RandomNumberGenerator): void
{
    // Two rows of columns flanking the region's central aisle. They run along whichever axis is
    // longer, so the aisle leads somewhere instead of dead-ending straight away.
    const runsAlongCols = inner.numCols >= inner.numRows;
    const spanLength = runsAlongCols ? inner.numCols : inner.numRows;
    if (spanLength < PILLAR_SPACING)
        return;

    const topLayer = (rand.randomInt(0, 2) == 0) ? COLLISION_LAYER_MAX : HALF_HEIGHT_PILLAR_TOP_LAYER;
    const textures = getSolidTextures(palette.propTextureIndex);

    // Centre the run of columns within the span, so that the colonnade comes out symmetric.
    const numPillars = 1 + Math.floor((spanLength - 1) / PILLAR_SPACING);
    const startOffset = Math.floor(0.5 * (spanLength - 1 - (numPillars - 1) * PILLAR_SPACING));

    for (let i = 0; i < numPillars; ++i)
    {
        const offset = startOffset + i * PILLAR_SPACING;
        const nearRow = inner.rowStart + (runsAlongCols ? 0 : offset);
        const nearCol = inner.colStart + (runsAlongCols ? offset : 0);
        const farRow = runsAlongCols ? (inner.rowStart + inner.numRows - 1) : nearRow;
        const farCol = runsAlongCols ? nearCol : (inner.colStart + inner.numCols - 1);

        addProp(voxelGrid, nearRow, nearCol, textures, COLLISION_LAYER_MIN, topLayer, keepClearRects);
        addProp(voxelGrid, farRow, farCol, textures, COLLISION_LAYER_MIN, topLayer, keepClearRects);
    }
}

function addCentrepiece(voxelGrid: VoxelGrid, inner: RoomGenerationRect,
    palette: RoomGenerationPalette, keepClearRects: RoomGenerationRect[]): void
{
    const size = (inner.numRows >= CENTREPIECE_MIN_REGION_SIZE &&
        inner.numCols >= CENTREPIECE_MIN_REGION_SIZE) ? 2 : 1;
    const rowStart = inner.rowStart + Math.floor(0.5 * (inner.numRows - size));
    const colStart = inner.colStart + Math.floor(0.5 * (inner.numCols - size));
    const textures = getPlinthTextures(palette);

    for (let row = rowStart; row < rowStart + size; ++row)
    {
        for (let col = colStart; col < colStart + size; ++col)
            addProp(voxelGrid, row, col, textures, COLLISION_LAYER_MIN, PLINTH_TOP_LAYER, keepClearRects);
    }
}

function addCornerBlocks(voxelGrid: VoxelGrid, inner: RoomGenerationRect,
    palette: RoomGenerationPalette, keepClearRects: RoomGenerationRect[]): void
{
    const textures = getPlinthTextures(palette);
    const rows = [inner.rowStart, inner.rowStart + inner.numRows - 1];
    const cols = [inner.colStart, inner.colStart + inner.numCols - 1];

    for (const row of rows)
    {
        for (const col of cols)
            addProp(voxelGrid, row, col, textures, COLLISION_LAYER_MIN, PLINTH_TOP_LAYER, keepClearRects);
    }
}

function addProp(voxelGrid: VoxelGrid, row: number, col: number, quadTextureIndicesWithinLayer: number[],
    collisionLayerMin: number, collisionLayerMax: number, keepClearRects: RoomGenerationRect[]): void
{
    if (keepClearRects.some(rect => RoomGenerationHelperUtil.rectContains(rect, row, col)))
        return;
    RoomGenerationHelperUtil.addWall(voxelGrid.voxels, row, col,
        quadTextureIndicesWithinLayer, collisionLayerMin, collisionLayerMax);
}

// Quad texture indices are ordered [-y, +y, -x, +x, -z, +z].
function getSolidTextures(textureIndex: number): number[]
{
    return [textureIndex, textureIndex, textureIndex, textureIndex, textureIndex, textureIndex];
}

// A plinth is only ever seen from the outside, so its sides carry the region's wall texture and
// only its exposed top gets the accent one.
function getPlinthTextures(palette: RoomGenerationPalette): number[]
{
    const side = palette.wallTextureIndex;
    return [side, palette.propTextureIndex, side, side, side, side];
}

function collectMountings(voxelGrid: VoxelGrid, keepClearRects: RoomGenerationRect[]): Mounting[]
{
    const mountings: Mounting[] = [];
    for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
    {
        for (let col = 0; col < NUM_VOXEL_COLS; ++col)
        {
            const voxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels, row, col);
            if (!voxel || voxel.collisionLayerMask == 0)
                continue; // nothing solid here to hang a painting on
            if (keepClearRects.some(rect => RoomGenerationHelperUtil.rectContains(rect, row, col)))
                continue;

            for (const dirName of MOUNTING_DIR_NAMES)
            {
                const dir = DIR_VEC_BY_NAME[dirName];
                mountings.push({row, col, dirName, dir});
            }
        }
    }
    return mountings;
}

// A painting hangs on a wall, never on the furniture: the cell behind it has to be solid all
// the way from floor to ceiling, and the cell in front of it has to be open at the height the
// painting would occupy, so that the painting is not buried inside the wall.
function canHangAt(voxelGrid: VoxelGrid, mounting: Mounting, bottomLayer: number): boolean
{
    const back = VoxelQueryUtil.getVoxel(voxelGrid.voxels, mounting.row, mounting.col);
    const front = VoxelQueryUtil.getVoxel(voxelGrid.voxels,
        mounting.row + mounting.dir.z, mounting.col + mounting.dir.x);
    if (!back || !front)
        return false;
    return back.collisionLayerMask == FULL_HEIGHT_COLLISION_LAYER_MASK &&
        !coversCanvasHeight(front, bottomLayer);
}

function coversCanvasHeight(voxel: Voxel, bottomLayer: number): boolean
{
    return VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, bottomLayer) &&
        VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, bottomLayer + 1);
}

// Derived from the wall face rather than generated, so that the id is unique by construction and
// stays the same every time the room is rebuilt from its seed.
function getCanvasObjectId(mounting: Mounting): string
{
    return `canvas_${mounting.row}_${mounting.col}_${mounting.dirName}`;
}

function shuffle<T>(items: T[], rand: RandomNumberGenerator): T[]
{
    for (let i = items.length - 1; i > 0; --i)
    {
        const j = rand.randomInt(0, i + 1);
        const temp = items[i];
        items[i] = items[j];
        items[j] = temp;
    }
    return items;
}

export default RoomGenerationDecorUtil;
