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
import Room from "../../../room/types/room";
import { COLLISION_LAYER_HEIGHT, INSTANCED_EMISSIVE_MATERIAL_ID,
    LIGHT_COLOR_PALETTE_NAME,
    WALL_ATTACHMENT_HITBOX_INSET} from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import { ObjectCategoryEnumMap } from "../objectCategory";
import ObjectTypeConfig from "./objectTypeConfig";
import ObjectScaleUtil from "../../util/objectScaleUtil";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";

// Lamps have a single pre-encoded appearance (authored in the pre-encoding source; see
// @docs/graphics/instanced_mesh_composition.md).
const COMPOSITION_CODEC_VERSION = 0;


// One voxel wide, one layer tall (attachments claim whole columns). This is the collider; the tested
// box is slightly inset (see PhysicsColliderStateUtil).
const LAMP_FOOTPRINT_WIDTH = 1;
const LAMP_FOOTPRINT_HEIGHT = COLLISION_LAYER_HEIGHT;

// Character positions in the stored string; never reorder.
const COLOR_CHAR_INDEX = 0;
const INTENSITY_CHAR_INDEX = 1;
const RANGE_CHAR_INDEX = 2;

// Default: white, moderate intensity, room-sized range, so a new lamp is visibly an ordinary light
// (see LampLightUtil).
const DEFAULT_COLOR_INDEX = 0;
const DEFAULT_INTENSITY = 3;
const DEFAULT_RANGE = 6;

// Only the light is editable; the appearance is derived from it (see generateDefaultParts).
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.LightProperties,
];

// Wall lamps (see @docs/graphics/lighting.md). Anyone may edit them, subject to restricted zones (see
// ObjectUpdateUtil).
const WallLampObjectTypeConfig =
{
    objectType: "WallLamp",
    persistent: true,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Lamp,
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
        // A lamp is slid along the wall by a gizmo, which is a placement rather than a motion.
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
                // Claims its wall patch; removing the wall removes the lamp.
                colliderType: "wallAttachment",
                baseHitboxSize: {
                    sizeX: LAMP_FOOTPRINT_WIDTH,
                    sizeY: LAMP_FOOTPRINT_HEIGHT,
                    sizeZ: 0.5 * WALL_ATTACHMENT_HITBOX_INSET
                },
                applyHardCollisionToOthers: false, // pass-through: the wall behind already blocks the player
                outgoingSoftCollisionForceMultiplier: 0,
                incomingSoftCollisionForceMultiplier: 0,
                maxClimbableHeight: 0,
            },
            instancedMeshGraphics: {},
            instancedMeshComposer: {
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Indexed,
                codecVersion: COMPOSITION_CODEC_VERSION,
                // Shape from the pre-encoded composition; emissive part color derived from the light, so
                // the lamp can't glow one color and light another. Light changes rebuild the parts (see
                // WallLampGameObject).
                generateDefaultParts: (obj: AddObjectSignal) => {
                    const params: InstancedMeshCompositionParams = {};
                    const parts: InstancedMeshCompositionPart[] = [];
                    CompositionMetadataUtil.decodeIndexed(PreEncodedCompositionIndexMap.WallLamp[0],
                        COMPOSITION_CODEC_VERSION,
                        ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, obj.transform.scale),
                        params, parts);

                    const color = ColorUtil.paletteIndexToRGB(LIGHT_COLOR_PALETTE_NAME,
                        readColorIndex(getLightProperties(obj)));
                    for (const part of parts)
                    {
                        // Unlit parts take their color from the lamp's light.
                        if (part.materialId == INSTANCED_EMISSIVE_MATERIAL_ID)
                            part.color = color;
                    }
                    return {params, parts};
                },
            },
            orbitOccluder: {}, // Part of the wall it is mounted on, as far as the orbit camera is concerned.
            lightSource: {},
        },
    },
    // Encodes/decodes the stored light properties (quantities in one character each; see LampLightUtil).
    // Decoding is total: missing characters default and out-of-range values clamp.
    util: {
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

export default WallLampObjectTypeConfig;
