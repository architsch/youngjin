import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import { InstancedMeshCompositionParams } from "../../../graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../../../graphics/mesh/composition/types/instancedMeshCompositionPart";
import CompositionMetadataUtil from "../../../graphics/mesh/composition/util/compositionMetadataUtil";
import PreEncodedCompositionIndexMap from "../../../graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import StringUtil from "../../../math/util/stringUtil";
import WaveformUtil from "../../../math/util/waveformUtil";
import Vec3 from "../../../math/types/vec3";
import Room from "../../../room/types/room";
import { ALL_FACE_DIRECTIONS, ATTACHMENT_HITBOX_INSET, RELIEF_STEP } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import { ObjectCategoryEnumMap } from "../objectCategory";
import { ObjectMetadata } from "../objectMetadata";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import ObjectScaleUtil from "../../util/objectScaleUtil";
import ObjectTypeConfig from "./objectTypeConfig";

const COMPOSITION_CODEC_VERSION = 0;

// The values a fan's two settings step through (see FanEditOptions), each stored as it is: how strong its wind is,
// and how far that reaches, in world units.
export const FAN_STRENGTHS = [1, 3, 5, 7, 9];
export const FAN_RANGES = [1, 3, 5, 7, 9];
const MAX_STRENGTH = FAN_STRENGTHS[FAN_STRENGTHS.length - 1];

// Character positions in the stored string; never reorder.
const STRENGTH_CHAR_INDEX = 0;
const RANGE_CHAR_INDEX = 1;

const DEFAULT_STRENGTH = 5;
const DEFAULT_RANGE = 5;

// How hard the strongest wind pushes at its face: the speed it adds in a second, in world units per second, several
// times gravity's own pull (see PhysicsForceUtil). A weaker one pushes by the square of its share of that strength,
// so that how high an upward fan lifts a body grows about as its strength does, and the weakest barely stirs it.
const STRONGEST_ACCELERATION = 144;
// How many times as hard a wind across the room pushes as one blowing down at the same strength, which would otherwise
// throw a body hardly faster than it walks; and a wind blowing upward.
const SIDEWAYS_PUSH_SCALE = 3;
const UPWARD_PUSH_SCALE = 1;
// The blades' turns per second for each unit of strength. Kept low, since a fast spin strobes.
const BLADE_TURNS_PER_STRENGTH = 0.3;
// How much the wind effect, drawn as the default strength blows it, changes for each unit of strength away from
// it: how fast its puffs go (taking as much longer to reach the end of the push), and how close behind each other
// they come. Their size and look are its own at any strength.
const WIND_PACE_PER_STRENGTH = 0.125;
const WIND_DENSITY_PER_STRENGTH = 0.075;

// How far the housing stands out of its face (see pre_encoding_source.json). The blades turn just in front of it.
const HOUSING_DEPTH = 0.0625;
// The share of the footprint the vent takes, the housing showing around it.
const VENT_SCALE = 0.86;

// Only the wind is editable; the look is the type's one.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.ForceProperties,
];

// Fans, on walls, floors or ceilings: a housing with blades turning in its vent, and a steady wind out of it that
// pushes whatever physics moves, and bounces it where it blows upward (see PhysicsForceUtil). The blades turn as
// fast as the wind is strong, the wind effect's puffs go faster and closer together the stronger it is, and it is
// as long as the push reaches. Anyone may edit them, subject to restricted zones (see ObjectUpdateUtil).
const FanObjectTypeConfig =
{
    objectType: "Fan",
    persistent: true,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Fan,
    attachment: {
        allowedDirections: ALL_FACE_DIRECTIONS,
    },
    force: {
        getAcceleration: (metadata: ObjectMetadata, direction: Vec3): number =>
            ((direction.y > 0) ? UPWARD_PUSH_SCALE : (direction.y == 0) ? SIDEWAYS_PUSH_SCALE : 1)
                * STRONGEST_ACCELERATION * (readStrength(getForceProperties(metadata)) / MAX_STRENGTH) ** 2,
        getRange: (metadata: ObjectMetadata): number => readRange(getForceProperties(metadata)),
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
        // A fan is dragged from face to face by a gizmo, which is a placement rather than a motion.
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
                // A unit square on its face, which is the stream's cross-section too; removing the block behind
                // removes the fan. The tested box is slightly inset (see PhysicsColliderStateUtil).
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
                // Its one look, the housing, which is never stored.
                generateDefaultParts: (obj: AddObjectSignal) => {
                    const params: InstancedMeshCompositionParams = {};
                    const parts: InstancedMeshCompositionPart[] = [];
                    CompositionMetadataUtil.decodeIndexed(PreEncodedCompositionIndexMap.Fan?.[0] ?? 0,
                        COMPOSITION_CODEC_VERSION,
                        ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, obj.transform.scale),
                        params, parts);
                    return {params, parts};
                },
                // Straight on, as it is mounted.
                thumbnailView: {yawDeg: 0, pitchDeg: 0},
            },
            orbitOccluder: {}, // Part of the face it is mounted on, as far as the orbit camera is concerned.
            animatedSprite: {
                baseline: {sprite: "fanBlades", widthScale: VENT_SCALE, heightScale: VENT_SCALE,
                    faceOffset: HOUSING_DEPTH + RELIEF_STEP},
                getOverride: (metadata: ObjectMetadata) => ({rate: WaveformUtil.constant(
                    BLADE_TURNS_PER_STRENGTH * readStrength(getForceProperties(metadata)))}),
            },
            particleEmitter: {
                baseline: {effect: "wind", faceOffset: HOUSING_DEPTH + 2 * RELIEF_STEP, stopAtBlocks: true},
                getOverride: (metadata: ObjectMetadata) => {
                    const fromDefault = readStrength(getForceProperties(metadata)) - DEFAULT_STRENGTH;
                    const pace = 1 + WIND_PACE_PER_STRENGTH * fromDefault;
                    // As many more a second as they go faster, so their spacing is down to the density alone.
                    return {reach: readRange(getForceProperties(metadata)), particleTimeScale: pace,
                        rateScale: pace * (1 + WIND_DENSITY_PER_STRENGTH * fromDefault)};
                },
            },
        },
    },
    util: {
        // Decode + encode round trip is the whole validation (see ObjectMetadataEntryMap). Decoding is total: a
        // missing character defaults, and any other reads as the nearest of its setting's values.
        canonicalize: (rawForceProperties: string): string =>
        {
            return encodeForceProperties(readStrength(rawForceProperties), readRange(rawForceProperties));
        },
        encodeForceProperties,
        getDefaultForceProperties: (): string =>
        {
            return encodeForceProperties(DEFAULT_STRENGTH, DEFAULT_RANGE);
        },
        // The two settings as a fan stores them, each one of its values.
        getStrength: (metadata: ObjectMetadata): number => readStrength(getForceProperties(metadata)),
        getRange: (metadata: ObjectMetadata): number => readRange(getForceProperties(metadata)),
    },
} satisfies ObjectTypeConfig;

function encodeForceProperties(strength: number, range: number): string
{
    const chars: string[] = [];
    chars[STRENGTH_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(getNearest(FAN_STRENGTHS, strength));
    chars[RANGE_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(getNearest(FAN_RANGES, range));
    return chars.join("");
}

function getForceProperties(metadata: ObjectMetadata): string
{
    return metadata[ObjectMetadataKeyEnumMap.ForceProperties]?.str ?? "";
}

function readStrength(forceProperties: string): number
{
    return getNearest(FAN_STRENGTHS,
        StringUtil.convertVisibleASCIIToRawNumber(forceProperties, STRENGTH_CHAR_INDEX, DEFAULT_STRENGTH));
}

function readRange(forceProperties: string): number
{
    return getNearest(FAN_RANGES,
        StringUtil.convertVisibleASCIIToRawNumber(forceProperties, RANGE_CHAR_INDEX, DEFAULT_RANGE));
}

// The one of a setting's values nearest a number: the lower of two as near, and the lowest for what is no number.
function getNearest(values: number[], n: number): number
{
    return values.reduce((nearest, value) => (Math.abs(value - n) < Math.abs(nearest - n)) ? value : nearest);
}

export default FanObjectTypeConfig;
