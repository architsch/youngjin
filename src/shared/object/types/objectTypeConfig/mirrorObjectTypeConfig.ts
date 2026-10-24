import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import CompositionMetadataUtil from "../../../graphics/mesh/composition/util/compositionMetadataUtil";
import ColorUtil from "../../../math/util/colorUtil";
import NumUtil from "../../../math/util/numUtil";
import StringUtil from "../../../math/util/stringUtil";
import Vec3 from "../../../math/types/vec3";
import Room from "../../../room/types/room";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";
import { ALL_FACE_DIRECTIONS, ATTACHMENT_HITBOX_INSET } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import { ObjectCategoryEnumMap } from "../objectCategory";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import ObjectScaleUtil from "../../util/objectScaleUtil";
import ObjectTypeConfig from "./objectTypeConfig";

const COMPOSITION_CODEC_VERSION = 0;

// The sizes a new mirror tries, in order: tall enough to show a person whole (a flat mirror needs half their height),
// then a canvas's (see CanvasObjectTypeConfig).
const START_SCALES: Vec3[] = [{x: 1, y: 1.5, z: 1}, {x: 1, y: 1, z: 1}, {x: 1, y: 0.5, z: 1}, {x: 0.5, y: 0.5, z: 1}];

// The palette a mirror's surface color is picked from: the full spectrum, in a copy of its own (see ColorPaletteMap).
export const MIRROR_COLOR_PALETTE_NAME = "Mirror";

// How opaque its surface may be over the reflection, in steps of 5%: from not at all (a plain mirror) to wholly (no
// reflection shows).
export const NUM_MIRROR_OPACITY_STEPS = 21;

// Character positions in the stored string; never reorder.
const COLOR_CHAR_INDEX = 0;
const OPACITY_CHAR_INDEX = 1;

// Default: a plain mirror, its surface a mid grey for when it is made to show.
const DEFAULT_COLOR_INDEX = 2;
const DEFAULT_OPACITY_STEP = 0;

// Metadata keys an admin may write to a mirror; anything else is refused.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.InstancedMeshComposition,
    ObjectMetadataKeyEnumMap.MirrorProperties,
];

// A mirror on any face of the room: a pane of glass showing the room reflected (see MirrorReflectionUtil), in a frame
// or not, framed as a canvas is and sized as one, up to twice as large each way, its surface a color laid over the
// reflection as opaquely as it is set to.
// Only an admin lays, moves, resizes, reframes or recolors one, and a room holds one at most (see
// ObjectCategoryConfigMap).
const MirrorObjectTypeConfig =
{
    objectType: "Mirror",
    persistent: true,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Mirror,
    // Resized in steps of a block's width across its face, up to twice a canvas's largest each way. Depth is the gap
    // from the face and never changes.
    scaling: {
        scaleStep: {x: 0.5, y: 0.5, z: 0},
        minScale: {x: 0.5, y: 0.5, z: 1},
        maxScale: {x: 7, y: 7, z: 1},
        getDefaultScale: (fits: (scale: Vec3) => boolean): Vec3 => START_SCALES.find(fits) ?? START_SCALES[0],
    },
    attachment: {
        allowedDirections: ALL_FACE_DIRECTIONS,
    },
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        if (!RoomValidationUtil.userIsAdmin(user))
            return false;

        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        return true;
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return RoomValidationUtil.userIsAdmin(user);
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        if (!RoomValidationUtil.userIsAdmin(user))
            return false;

        // A mirror is dragged from face to face by a gizmo, or resized where it stands, which are placements rather
        // than motions.
        if (!signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        if (!RoomValidationUtil.userIsAdmin(user))
            return false;
        if (!editableMetadataKeys.includes(signal.metadataKey))
            return false;

        // The frame must be one of a mirror's own looks. The surface's values are sanitized by ObjectMetadataEntryMap.
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.InstancedMeshComposition)
            return CompositionMetadataUtil.isIndexedLookOf("Mirror", COMPOSITION_CODEC_VERSION, signal.metadataValue);
        return true;
    },
    components: {
        spawnedByAny: {
            collider: {
                baseHitboxSize: {
                    sizeX: 1,
                    sizeY: 1,
                    sizeZ: 0.5 * ATTACHMENT_HITBOX_INSET
                },
                applyHardCollisionToOthers: false,
                outgoingSoftCollisionForceMultiplier: 0,
                incomingSoftCollisionForceMultiplier: 0,
                maxClimbableHeight: 0,
            },
            instancedMeshGraphics: {},
            // One of its pre-encoded looks, the first of which is frameless (see pre_encoding_source.json).
            instancedMeshComposer: {
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Indexed,
                codecVersion: COMPOSITION_CODEC_VERSION,
                generateDefaultParts: (obj: AddObjectSignal) => {
                    // Seeded from room and mirror id, so every client and session sees the same frame, as a canvas
                    // storing none does.
                    const hashCode = StringUtil.getHashCode(`${obj.roomID}/${obj.objectId}`);
                    return CompositionMetadataUtil.decodeSeededIndexed("Mirror", 1, hashCode,
                        COMPOSITION_CODEC_VERSION, ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, obj.transform.scale));
                },
                // Straight on, as it hangs.
                thumbnailView: {yawDeg: 0, pitchDeg: 0},
            },
            orbitOccluder: {}, // Part of the face it is on, as far as the orbit camera is concerned.
        },
    },
    util: {
        // The stored surface: a position in MIRROR_COLOR_PALETTE_NAME, and how opaque it is, in steps (see
        // NUM_MIRROR_OPACITY_STEPS) or as a share (0 for a plain mirror). Decoding is total: missing characters default
        // and out-of-range values clamp.
        getColorIndex: (obj: AddObjectSignal): number =>
        {
            return readColorIndex(getMirrorProperties(obj));
        },
        getOpacityStep: (obj: AddObjectSignal): number =>
        {
            return readOpacityStep(getMirrorProperties(obj));
        },
        getOpacity: (obj: AddObjectSignal): number =>
        {
            return readOpacityStep(getMirrorProperties(obj)) / (NUM_MIRROR_OPACITY_STEPS - 1);
        },
        // Decode + encode round trip is the whole validation (see ObjectMetadataEntryMap).
        canonicalize: (rawMirrorProperties: string): string =>
        {
            return encodeMirrorProperties(readColorIndex(rawMirrorProperties), readOpacityStep(rawMirrorProperties));
        },
        encodeMirrorProperties,
        getDefaultMirrorProperties: (): string =>
        {
            return encodeMirrorProperties(DEFAULT_COLOR_INDEX, DEFAULT_OPACITY_STEP);
        },
    },
} satisfies ObjectTypeConfig;

function encodeMirrorProperties(colorIndex: number, opacityStep: number): string
{
    const chars: string[] = [];
    chars[COLOR_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
        clampToWholeValue(colorIndex, 0, ColorUtil.getPaletteSize(MIRROR_COLOR_PALETTE_NAME) - 1));
    chars[OPACITY_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
        clampToWholeValue(opacityStep, 0, NUM_MIRROR_OPACITY_STEPS - 1));
    return chars.join("");
}

function getMirrorProperties(obj: AddObjectSignal): string
{
    return obj.metadata[ObjectMetadataKeyEnumMap.MirrorProperties]?.str ?? "";
}

function readColorIndex(mirrorProperties: string): number
{
    return NumUtil.clampInRange(StringUtil.convertVisibleASCIIToRawNumber(mirrorProperties, COLOR_CHAR_INDEX,
        DEFAULT_COLOR_INDEX), 0, ColorUtil.getPaletteSize(MIRROR_COLOR_PALETTE_NAME) - 1);
}

function readOpacityStep(mirrorProperties: string): number
{
    return NumUtil.clampInRange(StringUtil.convertVisibleASCIIToRawNumber(mirrorProperties, OPACITY_CHAR_INDEX,
        DEFAULT_OPACITY_STEP), 0, NUM_MIRROR_OPACITY_STEPS - 1);
}

// NaN becomes the minimum (clamping alone keeps NaN).
function clampToWholeValue(n: number, min: number, max: number): number
{
    if (!Number.isFinite(n))
        return min;
    return Math.round(NumUtil.clampInRange(n, min, max));
}

export default MirrorObjectTypeConfig;
