import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import { InstancedMeshCompositionParams } from "../../../graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../../../graphics/mesh/composition/types/instancedMeshCompositionPart";
import CompositionMetadataUtil from "../../../graphics/mesh/composition/util/compositionMetadataUtil";
import PreEncodedCompositionIndexMap from "../../../graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import ColorUtil from "../../../math/util/colorUtil";
import NumUtil from "../../../math/util/numUtil";
import StringUtil from "../../../math/util/stringUtil";
import WaveformUtil from "../../../math/util/waveformUtil";
import Vec2 from "../../../math/types/vec2";
import Vec3 from "../../../math/types/vec3";
import Room from "../../../room/types/room";
import { ALL_FACE_DIRECTIONS, ATTACHMENT_HITBOX_INSET, COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID,
    INSTANCED_TIN_MATERIAL_ID, RELIEF_STEP } from "../../../system/sharedConstants";
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

// The settings a fan steps through (see FanEditOptions): how many blades turn on its plate, each a rotor in a vent
// of its own, and with them how strong its wind is and how far that reaches, in world units. Stored as the
// strength alone (see readSetting).
export const FAN_SETTINGS = [
    {blades: 1, strength: 3, range: 3},
    {blades: 2, strength: 5, range: 5},
    {blades: 3, strength: 7, range: 7},
];
const DEFAULT_SETTING = FAN_SETTINGS[1];

// Character position in the stored string; never move it.
const STRENGTH_CHAR_INDEX = 0;

// The palette a fan's color is picked from: tin's, which a player's parts are painted from too (see ColorPaletteMap).
// A fan comes in a mid grey.
export const FAN_COLOR_PALETTE_NAME = COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID[INSTANCED_TIN_MATERIAL_ID];
const DEFAULT_COLOR_INDEX = 2;

// How hard a wind of strength 9 pushes at its face: the speed it adds in a second, in world units per second, several
// times gravity's own pull (see PhysicsForceUtil). Any other pushes by the square of its share of that strength, so
// that how high an upward fan lifts a body grows about as its strength does.
const FULL_STRENGTH = 9;
const FULL_STRENGTH_ACCELERATION = 144;
// How many times as hard a wind across the room pushes as one blowing down at the same strength, which would otherwise
// throw a body hardly faster than it walks; and a wind blowing upward.
const SIDEWAYS_PUSH_SCALE = 3;
const UPWARD_PUSH_SCALE = 1;
// The blades' turns per second, the same at every setting. Kept low, since a fast spin strobes.
const BLADE_TURNS_PER_SECOND = 1.5;
// How much the wind effect, drawn as the default setting blows it, changes for each unit of strength away from
// it: how fast its puffs go (taking as much longer to reach the end of the push), and how close behind each other
// they come. Their size and look are its own at any strength.
const WIND_PACE_PER_STRENGTH = 0.125;
const WIND_DENSITY_PER_STRENGTH = 0.075;

// How far the housing stands out of its face (see pre_encoding_source.json). The blades turn just in front of it.
const HOUSING_DEPTH = 0.0625;
// The share of the footprint each blade's vent takes, at any setting, and how far apart two vents' rims are: two side
// by side span the plate but for a rim of housing.
const VENT_SCALE = 0.45;
const VENT_GAP = 0.02;

// Only the setting and the color are editable; the housing itself is the type's one.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.ForceProperties,
    ObjectMetadataKeyEnumMap.FanColor,
];

// Fans, on walls, floors or ceilings: a housing with one to three blades turning in it, and one steady wind out of
// its middle that pushes whatever physics moves, and bounces it where it blows upward (see PhysicsForceUtil). The
// more blades, the stronger the wind and the farther it reaches; its puffs go faster and closer together the
// stronger it is, and it is as long as the push reaches. One color paints the housing and tints the wind.
// Anyone may edit them, subject to restricted zones (see ObjectUpdateUtil).
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
                * FULL_STRENGTH_ACCELERATION * (getSetting(metadata).strength / FULL_STRENGTH) ** 2,
        getRange: (metadata: ObjectMetadata): number => getSetting(metadata).range,
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
                // The housing takes the fan's stored color (a change recomposes the parts, see FanGameObject), and
                // stops a relief step short of the footprint's edges, where its half-sunk sides would share planes
                // with block faces and z-fight.
                deriveParts: (obj: AddObjectSignal, parts: InstancedMeshCompositionPart[]) => {
                    const color = ColorUtil.paletteIndexToRGB(FAN_COLOR_PALETTE_NAME, getColorIndex(obj.metadata));
                    const footprint = ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, obj.transform.scale);
                    for (const part of parts)
                    {
                        if (part.materialId != INSTANCED_TIN_MATERIAL_ID)
                            continue;
                        part.color = {...color};
                        part.scale = {...part.scale, x: Math.min(part.scale.x, footprint.x - 2 * RELIEF_STEP),
                            y: Math.min(part.scale.y, footprint.y - 2 * RELIEF_STEP)};
                    }
                },
                // Straight on, as it is mounted.
                thumbnailView: {yawDeg: 0, pitchDeg: 0},
            },
            orbitOccluder: {}, // Part of the face it is mounted on, as far as the orbit camera is concerned.
            animatedSprite: {
                baseline: {sprite: "fanBlades", widthScale: VENT_SCALE, heightScale: VENT_SCALE,
                    faceOffset: HOUSING_DEPTH + RELIEF_STEP, rate: WaveformUtil.constant(BLADE_TURNS_PER_SECOND)},
                getOverride: (metadata: ObjectMetadata) => ({centers: getBladeCenters(getSetting(metadata).blades)}),
            },
            particleEmitter: {
                baseline: {effect: "wind", faceOffset: HOUSING_DEPTH + 2 * RELIEF_STEP, stopAtBlocks: true},
                getOverride: (metadata: ObjectMetadata) => {
                    const {strength, range} = getSetting(metadata);
                    const fromDefault = strength - DEFAULT_SETTING.strength;
                    const pace = 1 + WIND_PACE_PER_STRENGTH * fromDefault;
                    // As many more a second as they go faster, so their spacing is down to the density alone.
                    return {reach: range, particleTimeScale: pace,
                        rateScale: pace * (1 + WIND_DENSITY_PER_STRENGTH * fromDefault),
                        tint: ColorUtil.rgbToHex(ColorUtil.paletteIndexToRGB(FAN_COLOR_PALETTE_NAME,
                            getColorIndex(metadata)))};
                },
            },
        },
    },
    util: {
        // Decode + encode round trip is the whole validation of each key (see ObjectMetadataEntryMap).
        canonicalizeForceProperties: (rawForceProperties: string): string =>
        {
            return encodeForceProperties(readSetting(rawForceProperties));
        },
        canonicalizeColor: (rawColor: string): string =>
        {
            return encodeColor(readColorIndex(rawColor));
        },
        encodeForceProperties,
        // As its key stores it.
        encodeColor,
        getDefaultForceProperties: (): string =>
        {
            return encodeForceProperties(DEFAULT_SETTING);
        },
        getDefaultColor: (): string =>
        {
            return encodeColor(DEFAULT_COLOR_INDEX);
        },
        // One of FAN_SETTINGS.
        getSetting,
        // A position in FAN_COLOR_PALETTE_NAME.
        getColorIndex,
    },
} satisfies ObjectTypeConfig;

function encodeForceProperties(setting: {strength: number}): string
{
    return StringUtil.convertRawNumberToVisibleASCII(setting.strength);
}

function encodeColor(colorIndex: number): string
{
    return StringUtil.convertRawNumberToVisibleASCII(clampToPalette(colorIndex));
}

function getSetting(metadata: ObjectMetadata)
{
    return readSetting(metadata[ObjectMetadataKeyEnumMap.ForceProperties]?.str ?? "");
}

// Total: the setting whose strength is nearest the stored one (the weaker of two as near), and the default where
// none is stored. Anything after the strength is ignored.
function readSetting(forceProperties: string)
{
    const strength = StringUtil.convertVisibleASCIIToRawNumber(forceProperties, STRENGTH_CHAR_INDEX,
        DEFAULT_SETTING.strength);
    return FAN_SETTINGS.reduce((nearest, setting) =>
        (Math.abs(setting.strength - strength) < Math.abs(nearest.strength - strength)) ? setting : nearest);
}

function getColorIndex(metadata: ObjectMetadata): number
{
    return readColorIndex(metadata[ObjectMetadataKeyEnumMap.FanColor]?.str ?? "");
}

// Total: the default where none is stored, and the palette's last color for a position past it. Anything after the
// first character is ignored.
function readColorIndex(storedColor: string): number
{
    return clampToPalette(StringUtil.convertVisibleASCIIToRawNumber(storedColor, 0, DEFAULT_COLOR_INDEX));
}

// NaN becomes the first color (clamping alone keeps NaN).
function clampToPalette(colorIndex: number): number
{
    if (!Number.isFinite(colorIndex))
        return 0;
    return Math.round(NumUtil.clampInRange(colorIndex, 0, ColorUtil.getPaletteSize(FAN_COLOR_PALETTE_NAME) - 1));
}

// Where a fan's blades turn on its plate, as shares of its footprint (see AnimatedSpriteDescriptor): a lone one in
// the middle; two side by side; three in a triangle, its point up, centred top to bottom.
function getBladeCenters(blades: number): Vec2[]
{
    if (blades <= 1)
        return [{x: 0, y: 0}];
    const across = 0.5 * (VENT_SCALE + VENT_GAP);
    if (blades == 2)
        return [{x: -across, y: 0}, {x: across, y: 0}];
    const rise = 0.5 * Math.sqrt(3) * across;
    return [{x: 0, y: rise}, {x: -across, y: -rise}, {x: across, y: -rise}];
}

export default FanObjectTypeConfig;
