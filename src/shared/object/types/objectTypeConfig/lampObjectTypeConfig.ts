import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import { MAX_LAMP_INTENSITY, MAX_LAMP_RANGE, MIN_LAMP_INTENSITY,
    MIN_LAMP_RANGE } from "../../../graphics/light/util/lampLightUtil";
import ColorUtil from "../../../math/util/colorUtil";
import NumUtil from "../../../math/util/numUtil";
import StringUtil from "../../../math/util/stringUtil";
import MeshDataUtil from "../../../graphics/mesh/util/meshDataUtil";
import Room from "../../../room/types/room";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";
import { BACKWARD_DIR, COLLISION_LAYER_HEIGHT, INSTANCED_EMISSIVE_MATERIAL_ID,
    LIGHT_COLOR_PALETTE_NAME, 
    WALL_ATTACHMENT_HITBOX_INSET} from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import ObjectTypeConfig from "./objectTypeConfig";
import ObjectTypeConfigMap from "../../maps/objectTypeConfigMap";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";

// A lamp's lit face is a single flat quad.
const LAMP_GEOMETRY_ID = "Square";

// How much wall a lamp lays claim to, and therefore how much of it is drawn: one voxel across and
// one collision layer tall. A wall attachment claims whole voxel columns of wall horizontally
// (see WallAttachedObjectUtil), so anything narrower would claim the same stretch while looking
// like it had been squeezed into a corner of it. This is the lamp's collider, which is where
// everything outside this file reads a lamp's footprint from — the box it is actually tested
// against is a hair inside it (see PhysicsColliderStateUtil).
const LAMP_FOOTPRINT_WIDTH = 1;
const LAMP_FOOTPRINT_HEIGHT = COLLISION_LAYER_HEIGHT;

// Every lamp in the room draws its parts from one pool of mesh instances, so the room can only hold
// as many as that pool was sized for. What actually bounds the number is not the drawing — the block
// map costs the same whether a room holds three lamps or three hundred (see LightBlockMap) — but the
// propagation each one costs, the clutter of a wall covered in them, and the size of the room's own
// stored contents.
const MAX_LAMPS_PER_ROOM = 24;
const MAX_MESH_INSTANCES_PER_LAMP = 4;

// How far the lit face stands off the wall behind it. Enough to keep it clear of the wall's own
// surface, and no more — what is drawn is the face of a fitting mounted flush, not a panel floating
// in front of one.
const EMITTER_RELIEF = 0.01;

// Where each of the lamp's settings sits in its stored string. Fixed positions, never reordered: a
// character's position is its whole meaning, so moving one re-lights every lamp already installed.
const COLOR_CHAR_INDEX = 0;
const INTENSITY_CHAR_INDEX = 1;
const RANGE_CHAR_INDEX = 2;

// A lamp with nothing said about it burns plain white, at about a quarter of the strength it can be
// given and over most of a room. Chosen so that a lamp is always *something* — a lamp that arrived
// dark would read as broken rather than as unconfigured, and there is nothing on screen to tell the
// two apart by — and so that it arrives as an ordinary room light rather than at the top of a range
// that exists for dramatic effect (see LampLightUtil).
const DEFAULT_COLOR_INDEX = 0;
const DEFAULT_INTENSITY = 3;
const DEFAULT_RANGE = 10;

// The metadata a lamp answers to, which is only the light it gives off. Notably *not* its
// composition: what a lamp looks like is derived from its light rather than authored beside it (see
// generateDefaultParts below), so there is nothing about its appearance left to store, and a stored
// composition could only ever be one that disagreed with the light.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.LightProperties,
];

// A lamp is a light somebody installed on a wall — the only thing in the game that lights a room
// other than the light every visitor carries (see @docs/graphics/lighting.md). It is admin-only for
// now, being a placeholder: what it looks like is a single lit rectangle, and what a room is
// actually furnished with should be a fitting with a body.
const LampObjectTypeConfig =
{
    objectType: "Lamp",
    persistent: true,
    autoUnload: true,
    maxCountPerRoom: MAX_LAMPS_PER_ROOM,
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        if (!RoomValidationUtil.userIsAdmin(user))
            return false;

        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        // The room can only hold as many lamps as the mesh instance pool was sized for. Looked up
        // here rather than at module scope: this file is inside the object-config import cycle (see
        // DoorObjectTypeConfig).
        const typeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
        const lampCount = Object.values(room.objectById)
            .filter(obj => obj.objectTypeIndex === typeIndex).length;
        if (lampCount >= MAX_LAMPS_PER_ROOM)
            return false;

        return true;
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return RoomValidationUtil.userIsAdmin(user);
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        if (!RoomValidationUtil.userIsAdmin(user))
            return false;

        // A lamp is slid along the wall by a gizmo, which is a placement rather than a motion.
        if (!signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        if (!RoomValidationUtil.userIsAdmin(user))
            return false;

        // The values themselves are settled by ObjectMetadataEntryMap, which clamps a lamp's color
        // and strength into range, so what is left to ask here is only which keys a lamp answers to.
        return editableMetadataKeys.includes(signal.metadataKey);
    },
    components: {
        spawnedByAny: {
            collider: {
                // A lamp lays claim to the patch of wall it is mounted on, so nothing else can be
                // hung over it — and so that taking the wall away takes the lamp with it.
                colliderType: "wallAttachment",
                hitboxSize: {
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
                maxNumInstancesPerMesh: MAX_LAMPS_PER_ROOM * MAX_MESH_INSTANCES_PER_LAMP,
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Default,
                codecVersion: 0,
                // One lit rectangle filling the patch of wall the lamp claims, in the color of the
                // light it gives off.
                //
                // **The color is derived from the lamp's light rather than authored beside it**,
                // which is what keeps a lamp from being able to glow one color and light the room
                // another. A change to the light rebuilds these parts (see LampGameObject), so the
                // two are re-derived together every time.
                generateDefaultParts: (obj: AddObjectSignal) => {
                    const color = ColorUtil.paletteIndexToRGB(LIGHT_COLOR_PALETTE_NAME,
                        readColorIndex(getLightProperties(obj)));
                    return {
                        params: {},
                        parts: [{
                            instancedMeshId: MeshDataUtil.getInstancedMeshId(LAMP_GEOMETRY_ID,
                                INSTANCED_EMISSIVE_MATERIAL_ID),
                            // A wall attachment carries its facing in the object's own rotation, so
                            // every part of it simply faces the object's local forward and turns
                            // with the wall (the same as a door's regions and a canvas's one quad).
                            dir: BACKWARD_DIR,
                            offset: {x: 0, y: 0, z: EMITTER_RELIEF},
                            scale: {x: LAMP_FOOTPRINT_WIDTH, y: LAMP_FOOTPRINT_HEIGHT, z: 1},
                            color,
                        }],
                    };
                },
            },
            orbitOccluder: {}, // Part of the wall it is mounted on, as far as the orbit camera is concerned.
            lightSource: {},
        },
    },
    // What a lamp gives off, to and from the three characters it stores.
    //
    // The two light settings are stored as the quantities themselves rather than as positions on a
    // scale (see LampLightUtil), which is what lets the same number be shown to whoever is adjusting
    // the lamp. They still fit in one character each, since everything stored on an object is
    // quantized the same way (see StringUtil) and both ranges are far inside what one character
    // carries.
    //
    // Reading is total: any string at all decodes to a lamp, including the empty one a lamp arrives
    // with before anybody has adjusted it, one from a version that stored fewer settings than this
    // one does — a character past the end of the string reads back as that setting's default — and
    // one carrying a number outside the range its setting allows, which is clamped into it.
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
        // The same string written back out after being read, which is how a value arriving from
        // anywhere but this file is made safe to store (see ObjectMetadataEntryMap). Reading is
        // total and writing clamps, so the round trip is the whole of the validation.
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

// A stored character addresses far more numbers than any of these settings allows, so what comes
// back is clamped to the setting's own range rather than to the encoding's — a lamp naming a range
// no lamp has is asking for something that does not exist, exactly as one naming a palette entry
// past the end of the palette is.
function readValue(lightProperties: string, charIndex: number, fallback: number, min: number,
    max: number): number
{
    const raw = StringUtil.convertVisibleASCIIToRawNumber(lightProperties, charIndex, fallback);
    return NumUtil.clampInRange(raw, min, max);
}

// Clamping alone leaves NaN as NaN, and the character that comes of that is not one this encoding
// can read back — so anything that is not a number at all is treated as the bottom of the range.
function clampToWholeValue(n: number, min: number, max: number): number
{
    if (!Number.isFinite(n))
        return min;
    return Math.round(NumUtil.clampInRange(n, min, max));
}

export default LampObjectTypeConfig;
