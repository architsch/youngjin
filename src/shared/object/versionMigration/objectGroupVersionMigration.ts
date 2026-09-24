import EncodableByteString from "../../networking/types/encodableByteString";
// Type-only: ObjectGroup imports this module, so a value import would be an import cycle.
import type ObjectGroup from "../types/objectGroup";
import ObjectTransform from "../types/objectTransform";
import DoorObjectTypeConfig from "../types/objectTypeConfig/doorObjectTypeConfig";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import ObjectScaleUtil from "../util/objectScaleUtil";
import ObjectAttachmentUtil from "../util/objectAttachmentUtil";
import LabelTextUtil from "../util/labelTextUtil";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import NumUtil from "../../math/util/numUtil";
import StringUtil from "../../math/util/stringUtil";
import Vector3DUtil from "../../math/util/vector3DUtil";
import Vec3 from "../../math/types/vec3";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import CompositionMetadataUtil from "../../graphics/mesh/composition/util/compositionMetadataUtil";
import PreEncodedCompositionIndexMap from "../../graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import FramedPanelCompositionParams from "../../graphics/mesh/composition/types/compositionParams/framedPanelCompositionParams";
import DoorCompositionParams from "../../graphics/mesh/composition/types/compositionParams/doorCompositionParams";
import { InstancedMeshCompositionParams } from "../../graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import ColorUtil from "../../math/util/colorUtil";
import LightPaletteVersionMigration from "../../math/versionMigration/lightPaletteVersionMigration";
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

// A label's font size before sizes came from a list: a step of this range, in the LabelFont string's
// second character (see LabelTextUtil).
const LEGACY_LABEL_FONT_SIZE_CHAR_INDEX = 1;
const LEGACY_MIN_LABEL_FONT_SIZE = 16;
const LEGACY_LABEL_FONT_SIZE_STEP = 8;
const LEGACY_NUM_LABEL_FONT_SIZE_STEPS = 31;
const LEGACY_DEFAULT_LABEL_FONT_SIZE_STEP = 6;

// A lamp's color, as a "Light" palette position in its LightProperties string's first character.
const LEGACY_LIGHT_COLOR_CHAR_INDEX = 0;

// Codecs doors, canvases and labels stored their own finishes through, before each became a choice of
// pre-encoded looks. Every one was at version 0.
const LEGACY_CODEC_TYPE_BY_OBJECT_TYPE: {[objectType: string]: number} = {Door: 2, Canvas: 4, Label: 6};

// A canvas's or a label's band width, as the step its codec stored it at.
const LEGACY_MIN_MOULDING_THICKNESS = 0.04;
const LEGACY_MOULDING_THICKNESS_STEP = 0.02;
const LEGACY_NUM_MOULDING_THICKNESS_STEPS = 7;

// A canvas's or a label's flags char.
const LEGACY_CONVEX_FLAG = 1;
const LEGACY_FRAMED_FLAG = 2;

// How far a stored finish reads from a look on offer: colors by RGB distance, and a band width step or a
// flipped profile counting as much as a slight tint.
const LEGACY_FINISH_BAND_STEP_WEIGHT = 16;
const LEGACY_FINISH_PROFILE_WEIGHT = 16;

// Bitmap canvas frames were cells of a square atlas, this many cells a side.
const LEGACY_CANVAS_FRAME_ATLAS_CELLS_PER_SIDE = 4;

// Each bitmap frame's look-alike in wood inputs, by atlas cell (row by row): frame and inner colors from
// the "Timber" palette, band width and profile. The old borders came in four widths, each kept at the
// nearest band width on offer, which caps the carved frames'. Colors are matched against how the wood
// material ages them, so saturated frames (the gold, the orange wood) come out muted.
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
                encodeLegacyFramedPanel(LEGACY_CODEC_TYPE_BY_OBJECT_TYPE.Canvas, LEGACY_CANVAS_FRAMES[cellIndex]));
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
    (objectGroup: ObjectGroup) => { // version 5 -> 6
        // Lamps lost their frame and margin, and their look now follows their size: a stored look is
        // dropped, and a lamp past the largest size shrinks to it where it stands, on the placement grid.
        const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
        for (const object of Object.values(objectGroup.objectById))
        {
            if (object.objectTypeIndex !== lampTypeIndex)
                continue;
            delete object.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition];

            // Its bottom edge holds on a wall, as in a resize where it stands (see
            // ObjectAttachmentUtil.getResizedInPlace), measured at the size it was stored at, which the
            // current limits no longer read back. A lamp's footprint is a unit square, so scale is size.
            const {pos, dir, scale: storedScale} = object.transform;
            const scale = ObjectScaleUtil.sanitize(lampTypeIndex, storedScale);
            const {right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
            const heightOf = (size: Vec3) => Math.abs(right.y) * size.x + Math.abs(up.y) * size.y;
            const heldPos = {...pos, y: pos.y + 0.5 * (heightOf(scale) - heightOf(storedScale))};
            object.transform = ObjectAttachmentUtil.getResizedInPlace(lampTypeIndex,
                new ObjectTransform(heldPos, dir, scale), scale);
        }

        // Label font sizes went from a step of a range to a place in a shorter list of sizes: each keeps the
        // nearest size still on offer.
        for (const object of Object.values(objectGroup.objectById))
        {
            const font = object.metadata[ObjectMetadataKeyEnumMap.LabelFont]?.str;
            if (font == undefined)
                continue;
            const step = NumUtil.clampInRange(StringUtil.convertVisibleASCIIToRawNumber(font,
                LEGACY_LABEL_FONT_SIZE_CHAR_INDEX, LEGACY_DEFAULT_LABEL_FONT_SIZE_STEP),
                0, LEGACY_NUM_LABEL_FONT_SIZE_STEPS - 1);
            object.metadata[ObjectMetadataKeyEnumMap.LabelFont] = new EncodableByteString(
                LabelTextUtil.encodeFont(LabelTextUtil.getFont(object).autoSize,
                    LEGACY_MIN_LABEL_FONT_SIZE + step * LEGACY_LABEL_FONT_SIZE_STEP));
        }

        // The "Light" palette was cut to a few temperatures and hues: a lamp's color becomes the nearest one
        // left.
        for (const object of Object.values(objectGroup.objectById))
        {
            const lightProperties = object.metadata[ObjectMetadataKeyEnumMap.LightProperties]?.str;
            if (lightProperties == undefined)
                continue;
            object.metadata[ObjectMetadataKeyEnumMap.LightProperties] = new EncodableByteString(
                LightPaletteVersionMigration.convertColorChar(lightProperties, LEGACY_LIGHT_COLOR_CHAR_INDEX));
        }

        // Doors, canvases and labels went from finishes of their own to a choice of pre-encoded looks: a
        // stored finish becomes the look nearest it, and an unframed panel the frameless look. One stored in
        // anything but its type's old codec is dropped, leaving the seeded default the composer showed.
        for (const object of Object.values(objectGroup.objectById))
        {
            const stored = object.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition]?.str;
            const config = ObjectTypeConfigMap.getConfigByIndex(object.objectTypeIndex);
            const legacyCodecType = LEGACY_CODEC_TYPE_BY_OBJECT_TYPE[config.objectType];
            if (stored == undefined || legacyCodecType == undefined)
                continue;

            const compositionIndex = (StringUtil.convertVisibleASCIIToRawNumber(stored, 0) == legacyCodecType)
                ? getNearestLook(config.objectType, stored) : undefined;
            if (compositionIndex == undefined)
            {
                delete object.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition];
                continue;
            }
            object.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition] = new EncodableByteString(
                CompositionMetadataUtil.encodeIndexed(compositionIndex,
                    config.components.spawnedByAny?.instancedMeshComposer?.codecVersion ?? 0));
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
    mouldingIsConvex: boolean): FramedPanelCompositionParams
{
    return {colors: {frame: ColorUtil.hexToRGB(frame), inner: ColorUtil.hexToRGB(inner)},
        mouldingThickness, mouldingIsConvex, framed: true};
}

// A canvas's or a label's finish as its own codec stored it: frame and inner colors as "Timber" palette
// positions, the band width as a step, then the flags.
function encodeLegacyFramedPanel(codecType: number, finish: FramedPanelCompositionParams): string
{
    const raws = [
        ColorUtil.rgbToPaletteIndex("Timber", finish.colors.frame),
        ColorUtil.rgbToPaletteIndex("Timber", finish.colors.inner),
        Math.round((finish.mouldingThickness - LEGACY_MIN_MOULDING_THICKNESS) / LEGACY_MOULDING_THICKNESS_STEP),
        (finish.mouldingIsConvex ? LEGACY_CONVEX_FLAG : 0) | (finish.framed ? LEGACY_FRAMED_FLAG : 0),
    ];
    return CompositionMetadataUtil.getCodecPrefix(codecType, 0)
        + raws.map(raw => StringUtil.convertRawNumberToVisibleASCII(raw)).join("");
}

// Read as encodeLegacyFramedPanel writes it; a margin written after the flags is ignored. Nothing past the
// prefix was frameless, and a string cut short before its flags kept a proud frame.
function decodeLegacyFramedPanel(str: string): FramedPanelCompositionParams
{
    const read = (charIndex: number, fallback: number = 0) =>
        StringUtil.convertVisibleASCIIToRawNumber(str, charIndex, fallback);
    const flags = (str.length > 2) ? read(5, LEGACY_CONVEX_FLAG | LEGACY_FRAMED_FLAG) : 0;
    return {
        colors: {
            frame: ColorUtil.paletteIndexToRGB("Timber", read(2)),
            inner: ColorUtil.paletteIndexToRGB("Timber", read(3)),
        },
        mouldingThickness: LEGACY_MIN_MOULDING_THICKNESS + LEGACY_MOULDING_THICKNESS_STEP
            * NumUtil.clampInRange(read(4), 0, LEGACY_NUM_MOULDING_THICKNESS_STEPS - 1),
        mouldingIsConvex: (flags & LEGACY_CONVEX_FLAG) != 0,
        framed: (flags & LEGACY_FRAMED_FLAG) != 0,
    };
}

// A door's finish as its own codec stored it: timber, plate and knob as "Timber" palette positions.
function decodeLegacyDoorFinish(str: string): DoorCompositionParams["colors"]
{
    const read = (charIndex: number) =>
        ColorUtil.paletteIndexToRGB("Timber", StringUtil.convertVisibleASCIIToRawNumber(str, charIndex));
    return {panel: read(2), label: read(3), knob: read(4)};
}

// The composition index of the type's look nearest the finish it stored in its old codec, if any is near.
function getNearestLook(objectType: string, stored: string): number | undefined
{
    const distanceTo = (objectType == "Door")
        ? getDoorFinishDistance.bind(null, decodeLegacyDoorFinish(stored))
        : getPanelFinishDistance.bind(null, decodeLegacyFramedPanel(stored));
    let nearest: number | undefined = undefined;
    let nearestDistance = Infinity;
    for (const compositionIndex of PreEncodedCompositionIndexMap[objectType] ?? [])
    {
        const look: InstancedMeshCompositionParams = {};
        CompositionMetadataUtil.decodeIndexed(compositionIndex, 0, UNIT_VEC3, look, []);
        const distance = distanceTo(look);
        if (distance < nearestDistance)
        {
            nearest = compositionIndex;
            nearestDistance = distance;
        }
    }
    return nearest;
}

function getDoorFinishDistance(finish: DoorCompositionParams["colors"], look: DoorCompositionParams): number
{
    return Vector3DUtil.distSqr(finish.panel, look.colors.panel)
        + Vector3DUtil.distSqr(finish.label, look.colors.label)
        + Vector3DUtil.distSqr(finish.knob, look.colors.knob);
}

// An unframed finish matches only the frameless look, and a framed one only framed looks.
function getPanelFinishDistance(finish: FramedPanelCompositionParams, look: FramedPanelCompositionParams): number
{
    if (finish.framed != look.framed)
        return Infinity;
    if (!finish.framed)
        return 0;
    const bandSteps = (finish.mouldingThickness - look.mouldingThickness) / LEGACY_MOULDING_THICKNESS_STEP;
    const profileFlipped = finish.mouldingIsConvex != look.mouldingIsConvex;
    return Vector3DUtil.distSqr(finish.colors.frame, look.colors.frame)
        + Vector3DUtil.distSqr(finish.colors.inner, look.colors.inner)
        + (bandSteps * LEGACY_FINISH_BAND_STEP_WEIGHT) ** 2
        + (profileFlipped ? LEGACY_FINISH_PROFILE_WEIGHT ** 2 : 0);
}

export default ObjectGroupVersionMigration;
