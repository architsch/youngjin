import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import { InstancedMeshCompositionParams } from "../../../graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../../../graphics/mesh/composition/types/instancedMeshCompositionPart";
import CompositionMetadataUtil from "../../../graphics/mesh/composition/util/compositionMetadataUtil";
import PreEncodedCompositionIndexMap from "../../../graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import { MAX_LAMP_INTENSITY, MAX_LAMP_RANGE, MIN_LAMP_INTENSITY,
    MIN_LAMP_RANGE } from "../../../graphics/light/util/lampLightUtil";
import ColorUtil from "../../../math/util/colorUtil";
import NumUtil from "../../../math/util/numUtil";
import StringUtil from "../../../math/util/stringUtil";
import Vec3 from "../../../math/types/vec3";
import Room from "../../../room/types/room";
import { ALL_FACE_DIRECTIONS, ATTACHMENT_HITBOX_INSET, INSTANCED_EMISSIVE_MATERIAL_ID,
    LIGHT_COLOR_PALETTE_NAME } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import { ObjectCategoryEnumMap } from "../objectCategory";
import ObjectTypeConfig from "./objectTypeConfig";
import ObjectScaleUtil from "../../util/objectScaleUtil";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";

const COMPOSITION_CODEC_VERSION = 0;

// The sizes a lamp comes in, which are its whole scale grid (see scaling), in the order of its
// pre-encoded looks: a glow of each size (see pre_encoding_source.json).
const SIZES: Vec3[] = [
    {x: 0.5, y: 0.5, z: 1},
    {x: 1, y: 0.5, z: 1},
    {x: 0.5, y: 1, z: 1},
    {x: 1, y: 1, z: 1},
];

// Character positions in the stored string; never reorder.
const COLOR_CHAR_INDEX = 0;
const INTENSITY_CHAR_INDEX = 1;
const RANGE_CHAR_INDEX = 2;

// Default: white, moderate intensity, room-sized range, so a new lamp is visibly an ordinary light
// (see LampLightUtil).
const DEFAULT_COLOR_INDEX = 0;
const DEFAULT_INTENSITY = 3;
const DEFAULT_RANGE = 6;

// Only the light is editable; the look follows the size (see generateDefaultParts).
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.LightProperties,
];

// Lamps, on walls, floors or ceilings (see @docs/graphics/lighting.md). Anyone may edit them, subject to
// restricted zones (see ObjectUpdateUtil).
const LampObjectTypeConfig =
{
    objectType: "Lamp",
    persistent: true,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Lamp,
    // One of SIZES, picked from its edit options rather than by dragging a corner; with no roll to turn it
    // by, this is how it is shaped to suit whichever face it is on. Depth is the gap from the face and
    // never changes. A new one is one layer tall, so the side of a lone block holds it.
    scaling: {
        scaleStep: {x: 0.5, y: 0.5, z: 0},
        minScale: {x: 0.5, y: 0.5, z: 1},
        maxScale: {x: 1, y: 1, z: 1},
        defaultScale: {x: 1, y: 0.5, z: 1},
        cornerHandles: false,
    },
    attachment: {
        allowedDirections: ALL_FACE_DIRECTIONS,
    },
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        return true;
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return true;
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        // A lamp is dragged from face to face by a gizmo, or resized where it stands, which are placements
        // rather than motions.
        if (!signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        // Values are sanitized by ObjectMetadataEntryMap; only the key is checked here.
        return editableMetadataKeys.includes(signal.metadataKey);
    },
    components: {
        spawnedByAny: {
            collider: {
                // A unit square on its face, so its scale is its size; removing the block behind removes
                // the lamp. The tested box is slightly inset (see PhysicsColliderStateUtil).
                baseHitboxSize: {
                    sizeX: 1,
                    sizeY: 1,
                    sizeZ: 0.5 * ATTACHMENT_HITBOX_INSET
                },
                applyHardCollisionToOthers: false, // pass-through: the block behind already blocks the player
                outgoingSoftCollisionForceMultiplier: 0,
                incomingSoftCollisionForceMultiplier: 0,
                maxClimbableHeight: 0,
            },
            instancedMeshGraphics: {},
            instancedMeshComposer: {
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Indexed,
                codecVersion: COMPOSITION_CODEC_VERSION,
                // The look of its size, which is never stored. A resize re-decodes the live params, so it
                // points them at the new size's look first (see LampGameObject).
                generateDefaultParts: (obj: AddObjectSignal) => {
                    const params: InstancedMeshCompositionParams = {};
                    const parts: InstancedMeshCompositionPart[] = [];
                    CompositionMetadataUtil.decodeIndexed(getCompositionIndex(obj), COMPOSITION_CODEC_VERSION,
                        ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, obj.transform.scale),
                        params, parts);
                    return {params, parts};
                },
                // The glow takes its light's color. Light changes recompose the parts (see LampGameObject).
                deriveParts: (obj: AddObjectSignal, parts: InstancedMeshCompositionPart[]) => {
                    const color = ColorUtil.paletteIndexToRGB(LIGHT_COLOR_PALETTE_NAME,
                        readColorIndex(getLightProperties(obj)));
                    for (const part of parts)
                    {
                        if (part.materialId == INSTANCED_EMISSIVE_MATERIAL_ID)
                            part.color = {...color};
                    }
                },
                // Straight on, so the sizes compare (a type's thumbnails share one framing).
                thumbnailView: {yawDeg: 0, pitchDeg: 0},
            },
            orbitOccluder: {}, // Part of the face it is mounted on, as far as the orbit camera is concerned.
            lightSource: {},
        },
    },
    util: {
        // The look of the lamp's size, as a pre-encoded composition index.
        getCompositionIndex,
        // The scale a look is drawn at, or undefined if the composition index isn't one of a lamp's looks.
        getScale: (compositionIndex: number): Vec3 | undefined =>
        {
            const size = SIZES[(PreEncodedCompositionIndexMap.Lamp ?? []).indexOf(compositionIndex)];
            return size && {...size};
        },
        getSizes: (): Vec3[] =>
        {
            return SIZES.map(size => ({...size}));
        },
        // The stored light properties (quantities in one character each; see LampLightUtil). Decoding is
        // total: missing characters default and out-of-range values clamp.
        getColorIndex: (obj: AddObjectSignal): number =>
        {
            return readColorIndex(getLightProperties(obj));
        },
        getIntensity: (obj: AddObjectSignal): number =>
        {
            return readIntensity(getLightProperties(obj));
        },
        getRange: (obj: AddObjectSignal): number =>
        {
            return readRange(getLightProperties(obj));
        },
        // Decode + encode round trip is the whole validation (see ObjectMetadataEntryMap).
        canonicalize: (rawLightProperties: string): string =>
        {
            return encodeLightProperties(
                readColorIndex(rawLightProperties),
                readIntensity(rawLightProperties),
                readRange(rawLightProperties));
        },
        encodeLightProperties,
        getDefaultLightProperties: (): string =>
        {
            return encodeLightProperties(DEFAULT_COLOR_INDEX, DEFAULT_INTENSITY, DEFAULT_RANGE);
        },
    },
} satisfies ObjectTypeConfig;

// Read through the sanitized scale, as the collider is, so the look and the footprint always agree.
function getCompositionIndex(obj: AddObjectSignal): number
{
    const scale = ObjectScaleUtil.sanitize(obj.objectTypeIndex, obj.transform.scale);
    const sizeIndex = Math.max(0, SIZES.findIndex(size => size.x == scale.x && size.y == scale.y));
    return PreEncodedCompositionIndexMap.Lamp?.[sizeIndex] ?? 0;
}

function encodeLightProperties(colorIndex: number, intensity: number, range: number): string
{
    const chars: string[] = [];
    chars[COLOR_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
        clampToWholeValue(colorIndex, 0, ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME) - 1));
    chars[INTENSITY_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
        clampToWholeValue(intensity, MIN_LAMP_INTENSITY, MAX_LAMP_INTENSITY));
    chars[RANGE_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
        clampToWholeValue(range, MIN_LAMP_RANGE, MAX_LAMP_RANGE));
    return chars.join("");
}

function getLightProperties(obj: AddObjectSignal): string
{
    return obj.metadata[ObjectMetadataKeyEnumMap.LightProperties]?.str ?? "";
}

function readColorIndex(lightProperties: string): number
{
    return readValue(lightProperties, COLOR_CHAR_INDEX, DEFAULT_COLOR_INDEX,
        0, ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME) - 1);
}

function readIntensity(lightProperties: string): number
{
    return readValue(lightProperties, INTENSITY_CHAR_INDEX, DEFAULT_INTENSITY,
        MIN_LAMP_INTENSITY, MAX_LAMP_INTENSITY);
}

function readRange(lightProperties: string): number
{
    return readValue(lightProperties, RANGE_CHAR_INDEX, DEFAULT_RANGE,
        MIN_LAMP_RANGE, MAX_LAMP_RANGE);
}

// Clamped to the setting's own range, not the encoding's.
function readValue(lightProperties: string, charIndex: number, fallback: number, min: number,
    max: number): number
{
    const raw = StringUtil.convertVisibleASCIIToRawNumber(lightProperties, charIndex, fallback);
    return NumUtil.clampInRange(raw, min, max);
}

// NaN becomes the minimum (clamping alone keeps NaN).
function clampToWholeValue(n: number, min: number, max: number): number
{
    if (!Number.isFinite(n))
        return min;
    return Math.round(NumUtil.clampInRange(n, min, max));
}

export default LampObjectTypeConfig;
