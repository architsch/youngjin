import EncodableByteString from "../../networking/types/encodableByteString";
// Type-only: ObjectGroup imports this module, so a value import would be an import cycle.
import type ObjectGroup from "../types/objectGroup";
import ObjectTransform from "../types/objectTransform";
import DoorObjectTypeConfig from "../types/objectTypeConfig/doorObjectTypeConfig";
import CanvasObjectTypeConfig from "../types/objectTypeConfig/canvasObjectTypeConfig";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import CompositionMetadataUtil from "../../graphics/mesh/composition/util/compositionMetadataUtil";
import CanvasCompositionParams from "../../graphics/mesh/composition/types/compositionParams/canvasCompositionParams";
import ColorUtil from "../../math/util/colorUtil";
import { COLLISION_LAYER_MIN, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL,
    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, UNIT_VEC3 } from "../../system/sharedConstants";
import BufferState from "../../networking/types/bufferState";

// Grid version where rooms became two storeys. Objects share a blob with the grid, and the object
// format's version byte didn't change then (only the Y range did; see ObjectTransform), so the grid
// version dates the objects.
const FIRST_TWO_STOREY_VOXEL_GRID_VERSION = 2;

// Object format version where a transform gained its scale. Earlier ones stop after the facing, so
// their bytes have to be read as the shorter record they are.
const FIRST_SCALED_TRANSFORM_VERSION = 4;

// Grid version where the entrance doorway was filled and the entrance door became a stored object.
// Older grids mean the room never stored its door.
const FIRST_STORED_ENTRANCE_DOOR_VOXEL_GRID_VERSION = 3;

// For objects decoded without a grid, which are current by construction. A literal, since importing
// VoxelGrid would be an import cycle.
export const CURRENT_ERA_VOXEL_GRID_VERSION = FIRST_STORED_ENTRANCE_DOOR_VOXEL_GRID_VERSION;

// The vertical range before rooms became two storeys.
const LEGACY_Y_RANGE_MAX = 4;

// A lamp's height before lamps could be resized: one layer, which is half the unit square they are now
// scaled from.
const LEGACY_LAMP_HEIGHT = 0.5;

// Bitmap canvas frames were cells of a square atlas, this many cells a side.
const LEGACY_CANVAS_FRAME_ATLAS_CELLS_PER_SIDE = 4;

// Each bitmap frame's look-alike in wood inputs, by atlas cell (row by row): frame and inner colors from
// the "Timber" palette, band width and profile. The old borders came in four widths, each kept at the
// nearest band width on offer, which caps the carved frames' (see CanvasCompositionConstants). Colors are
// matched against how the wood material ages them, so saturated frames (the gold, the orange wood) come
// out muted.
const LEGACY_CANVAS_FRAMES = [
    legacyCanvasFrame("#e6dcc8", "#f0e7d2", 0.12, true),  // white marble
    legacyCanvasFrame("#bdb59d", "#ded2b8", 0.12, false), // beige marble
    legacyCanvasFrame("#1ccec0", "#54de99", 0.14, true),  // jade
    legacyCanvasFrame("#8b6e18", "#5c5c5a", 0.12, true),  // rusted iron
    legacyCanvasFrame("#6b7f2e", "#1f4a2c", 0.12, false), // bronze green
    legacyCanvasFrame("#d4a017", "#c9a227", 0.10, true),  // gold
    legacyCanvasFrame("#8b1818", "#6d5b36", 0.12, true),  // mahogany
    legacyCanvasFrame("#d5cdb6", "#d5cdb6", 0.12, true),  // ivory
    legacyCanvasFrame("#1f7a7a", "#3f8f7a", 0.16, false), // carved green
    legacyCanvasFrame("#87816f", "#a29b86", 0.12, false), // grey
    legacyCanvasFrame("#ce661c", "#bdb59d", 0.12, true),  // copper
    legacyCanvasFrame("#647684", "#54b0de", 0.14, false), // lavender
    legacyCanvasFrame("#cea21c", "#debc54", 0.12, true),  // khaki marble
    legacyCanvasFrame("#a29b86", "#d5cdb6", 0.16, false), // carved silver
    legacyCanvasFrame("#ce1c1c", "#96603a", 0.12, true),  // orange wood
    legacyCanvasFrame("#5e3a26", "#7a3b62", 0.16, false), // carved dark wood
];

// Every version so far shares one body layout, so older groups are read as current ones and only their
// meaning is converted. Index N converts version N to N+1, in place.
const converters: ((objectGroup: ObjectGroup, roomID: string, sourceVoxelGridVersion: number) => void)[] = [
    (objectGroup: ObjectGroup, roomID: string, sourceVoxelGridVersion: number) => { // version 0 -> 1
        // Only objects from pre-two-storey grids had heights doubled; newer ones must be left alone.
        if (sourceVoxelGridVersion >= FIRST_TWO_STOREY_VOXEL_GRID_VERSION)
            return;

        // Heights were stored as fractions of the legacy range.
        const yScale = LEGACY_Y_RANGE_MAX / ObjectTransform.encodableBounds.maxY;
        for (const object of Object.values(objectGroup.objectById))
        {
            const {pos} = object.transform;
            object.transform.pos = {x: pos.x, y: pos.y * yScale, z: pos.z};
        }
    },
    (objectGroup: ObjectGroup, roomID: string, sourceVoxelGridVersion: number) => { // version 1 -> 2
        // Rooms from before stored entrance doors get one; newer rooms already have it (or an admin
        // removed it deliberately), so they must be left alone.
        if (sourceVoxelGridVersion >= FIRST_STORED_ENTRANCE_DOOR_VOXEL_GRID_VERSION)
            return;

        const entranceDoor = DoorObjectTypeConfig.util.makeEntranceDoor(roomID,
            INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, COLLISION_LAYER_MIN);
        objectGroup.addObject(entranceDoor);
    },
    (objectGroup: ObjectGroup) => { // version 2 -> 3
        // Bitmap canvas frames became composed wood frames: an atlas cell becomes its look-alike.
        const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
        const canvasComposer = CanvasObjectTypeConfig.components.spawnedByAny.instancedMeshComposer;
        for (const object of Object.values(objectGroup.objectById))
        {
            const frameCoords = object.metadata[ObjectMetadataKeyEnumMap.CanvasFrameCoords];
            if (frameCoords == undefined)
                continue;
            delete object.metadata[ObjectMetadataKeyEnumMap.CanvasFrameCoords];
            if (object.objectTypeIndex !== canvasTypeIndex)
                continue;

            // Anything but a valid cell is dropped, leaving the canvas its default frame.
            const match = /^(\d+),(\d+)$/.exec(frameCoords.str);
            const col = match ? parseInt(match[1]) : -1;
            const row = match ? parseInt(match[2]) : -1;
            if (col < 0 || row < 0 || col >= LEGACY_CANVAS_FRAME_ATLAS_CELLS_PER_SIDE
                || row >= LEGACY_CANVAS_FRAME_ATLAS_CELLS_PER_SIDE)
                continue;
            const cellIndex = col + LEGACY_CANVAS_FRAME_ATLAS_CELLS_PER_SIDE * row;
            object.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition] = new EncodableByteString(
                CompositionMetadataUtil.encode(canvasComposer.codecType, canvasComposer.codecVersion,
                    LEGACY_CANVAS_FRAMES[cellIndex]));
        }
    },
    () => { // version 3 -> 4
        // Transforms gained a scale; objects stored without one were all drawn at their type's base
        // size, and decodeTransform gives them that as it reads them.
    },
    (objectGroup: ObjectGroup) => { // version 4 -> 5
        // A lamp's base footprint went from one voxel by one layer to a unit square it is scaled from, so
        // lamps are halved in height to keep the size they were drawn at.
        const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
        for (const object of Object.values(objectGroup.objectById))
        {
            if (object.objectTypeIndex !== lampTypeIndex)
                continue;
            const {scale} = object.transform;
            object.transform.scale = {x: scale.x, y: LEGACY_LAMP_HEIGHT, z: scale.z};
        }
    },
];

const ObjectGroupVersionMigration =
{
    // Reads one object's transform out of a body of the given version. A transform has to come out
    // whole, so the scale an older record doesn't carry is filled in here rather than by a converter.
    decodeTransform: (bufferState: BufferState, formatVersion: number): ObjectTransform =>
    {
        if (formatVersion >= FIRST_SCALED_TRANSFORM_VERSION)
            return ObjectTransform.decode(bufferState) as ObjectTransform;

        const {pos, dir} = ObjectTransform.decodePosAndDir(bufferState);
        return new ObjectTransform(pos, dir, {...UNIT_VEC3});
    },
    // Converts a group read at an older version forward, one version at a time. The grid decoded from
    // the same blob dates the objects (see FIRST_TWO_STOREY_VOXEL_GRID_VERSION).
    convert: (objectGroup: ObjectGroup, version: number, latestVersion: number, roomID: string,
        sourceVoxelGridVersion: number): void =>
    {
        for (let fromVersion = version; fromVersion < latestVersion; ++fromVersion)
            converters[fromVersion](objectGroup, roomID, sourceVoxelGridVersion);
    },
}

function legacyCanvasFrame(frame: string, inner: string, mouldingThickness: number,
    mouldingIsConvex: boolean): CanvasCompositionParams
{
    return {colors: {frame: ColorUtil.hexToRGB(frame), inner: ColorUtil.hexToRGB(inner)},
        mouldingThickness, mouldingIsConvex, framed: true, margin: 0};
}

export default ObjectGroupVersionMigration;
