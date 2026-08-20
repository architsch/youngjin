import ImageMapUtil from "../../graphics/image/util/imageMapUtil";
import RandomNumberGenerator from "../../math/types/randomNumberGenerator";
import Vec3 from "../../math/types/vec3";
import EncodableByteString from "../../networking/types/encodableByteString";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../object/types/addObjectSignal";
import ObjectGroup from "../../object/types/objectGroup";
import { ObjectMetadataKeyEnumMap } from "../../object/types/objectMetadataKey";
import ObjectTransform from "../../object/types/objectTransform";
import { COLLISION_LAYER_HEIGHT, DIR_VEC_BY_NAME, FULL_COLLISION_LAYER_MASK, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import Voxel from "../../voxel/types/voxel";
import VoxelGrid from "../../voxel/types/voxelGrid";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import RoomGenerationVolume from "../types/roomGeneration/roomGenerationVolume";
import RoomGenerationVolumeUtil from "./roomGenerationVolumeUtil";

// Hangs paintings on the walls of a room whose floor plan is already built. Like the block work
// that furnishes it (see RoomGenerationPropsUtil), this works off the finished voxel grid, so it is
// equally usable on a room being generated from scratch and on one being redecorated.

// How far above the floor of its own storey a painting's lower edge may sit. A painting is one cell
// tall, so it covers this layer and the one above it — both well within a standing player's eyeline.
const CANVAS_BOTTOM_LAYER_OFFSETS = [2, 3];
const MIN_CANVAS_GAP = 3; // in cells, between two paintings hung on the same wall face

const MOUNTING_DIR_NAMES = ["-x", "+x", "-z", "+z"];

const RoomGenerationCanvasUtil =
{
    // Hangs paintings across the room, on whichever wall faces can take one, and returns how
    // many went up. Candidates are visited in a seeded random order and spaced out along each
    // wall, so the paintings end up scattered over the whole room rather than tiled along the
    // first wall that fits them.
    //
    // Every storey of the room is hung, each at its own eyeline, and the spacing is kept within a
    // storey rather than across them: two paintings one above the other on the same stretch of wall
    // are on two different walls as far as anyone looking at them is concerned.
    hangCanvases: (voxelGrid: VoxelGrid, objectGroup: ObjectGroup, maxCount: number,
        keepClearVolumes: RoomGenerationVolume[], storeys: RoomGenerationVolume[],
        rand: RandomNumberGenerator): number =>
    {
        const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
        const images = ImageMapUtil.getImageMap("CanvasImageMap").getImageMetadataList();
        const frames = ImageMapUtil.getImageMap("CanvasFrameImageMap").getImageMetadataList();

        const mountings = rand.shuffle(collectMountings(voxelGrid, keepClearVolumes, storeys));
        const hung: Mounting[] = [];

        for (const mounting of mountings)
        {
            if (hung.length >= maxCount)
                break;
            if (hung.some(other => tooCloseTogether(other, mounting)))
                continue;

            const bottomLayer = mounting.storey.collisionLayerStart +
                rand.pick(CANVAS_BOTTOM_LAYER_OFFSETS);
            if (!canHangAt(voxelGrid, mounting, bottomLayer))
                continue;

            // A wall-attached object sits on the boundary plane between the wall cell backing it
            // and the open cell in front, facing away from the wall.
            const dir = mounting.dir;
            const pos: Vec3 = {
                x: mounting.col + 0.5 + 0.5 * dir.x,
                y: COLLISION_LAYER_HEIGHT * (bottomLayer + 1),
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
                        new EncodableByteString(rand.pick(images).path),
                    [ObjectMetadataKeyEnumMap.CanvasFrameCoords]:
                        new EncodableByteString(rand.pick(frames).path),
                });
            hung.push(mounting);
        }
        return hung.length;
    },
}

// A wall face a painting could be hung on: the wall cell backing it, the direction the painting
// would face (i.e. out of that cell, into the open), and the storey of the room it would hang on —
// a wall stands through the whole room, so the same face offers one of these per storey.
interface Mounting
{
    row: number;
    col: number;
    dirName: string;
    dir: Vec3;
    storey: RoomGenerationVolume;
}

function collectMountings(voxelGrid: VoxelGrid, keepClearVolumes: RoomGenerationVolume[],
    storeys: RoomGenerationVolume[]): Mounting[]
{
    const mountings: Mounting[] = [];
    for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
    {
        for (let col = 0; col < NUM_VOXEL_COLS; ++col)
        {
            const voxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels, row, col);
            if (!voxel || voxel.collisionLayerMask == 0)
                continue; // nothing solid here to hang a painting on
            if (RoomGenerationVolumeUtil.coveredByAny(keepClearVolumes, row, col))
                continue;

            for (const dirName of MOUNTING_DIR_NAMES)
            {
                const dir = DIR_VEC_BY_NAME[dirName];
                for (const storey of storeys)
                    mountings.push({row, col, dirName, dir, storey});
            }
        }
    }
    return mountings;
}

// Whether two paintings would crowd each other, which is a question about one stretch of one wall
// face on one storey — the same face on the storey above is another wall as far as anyone looking
// at them is concerned.
function tooCloseTogether(a: Mounting, b: Mounting): boolean
{
    return a.dirName == b.dirName &&
        a.storey.collisionLayerStart == b.storey.collisionLayerStart &&
        Math.abs(a.row - b.row) + Math.abs(a.col - b.col) < MIN_CANVAS_GAP;
}

// A painting hangs on a wall, never on the furniture: the cell behind it has to be solid all
// the way from floor to ceiling, and the cell in front of it has to be open at the height the
// painting would occupy, so that the painting is not buried inside the wall.
//
// It also has to be a painting somebody can walk up to, which on a storey above the ground means
// the cell in front of it needs that storey's floor under it — otherwise the painting hangs over an
// open drop into the space below, where the only way to see it is to fall past it.
function canHangAt(voxelGrid: VoxelGrid, mounting: Mounting, bottomLayer: number): boolean
{
    const back = VoxelQueryUtil.getVoxel(voxelGrid.voxels, mounting.row, mounting.col);
    const front = VoxelQueryUtil.getVoxel(voxelGrid.voxels,
        mounting.row + mounting.dir.z, mounting.col + mounting.dir.x);
    if (!back || !front)
        return false;
    return back.collisionLayerMask == FULL_COLLISION_LAYER_MASK &&
        !coversCanvasHeight(front, bottomLayer) &&
        VoxelQueryUtil.isVoxelCollisionLayerOccupied(front,
            RoomGenerationVolumeUtil.getFloorCollisionLayer(mounting.storey));
}

function coversCanvasHeight(voxel: Voxel, bottomLayer: number): boolean
{
    return VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, bottomLayer) &&
        VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, bottomLayer + 1);
}

// Derived from the wall face rather than generated, so that the id is unique by construction and
// stays the same every time the room is rebuilt from its seed. The storey is part of it because one
// face of one wall offers a place to hang something on each of the room's storeys.
function getCanvasObjectId(mounting: Mounting): string
{
    return `canvas_${mounting.row}_${mounting.col}_${mounting.dirName}_${mounting.storey.collisionLayerStart}`;
}

export default RoomGenerationCanvasUtil;
