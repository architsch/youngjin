import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import { PlayerCompositionCodec } from "../../../graphics/mesh/composition/types/compositionCodec/playerCompositionCodec";
import StringUtil from "../../../math/util/stringUtil";
import Room from "../../../room/types/room";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";
import { DIR_VEC_BY_NAME } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import { ObjectCategoryEnumMap } from "../objectCategory";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import LabelTextUtil from "../../util/labelTextUtil";
import ObjectScaleUtil from "../../util/objectScaleUtil";
import NpcPersonalityMap from "../../maps/npcPersonalityMap";
import { NpcPersonality } from "../npcPersonality";
import ObjectTypeConfig from "./objectTypeConfig";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "./playerObjectTypeConfig";

// The distances, in world units, a helper may be set to go from home (see HelperAgentUtil), which an admin steps
// through. Stored as the number itself.
export const NPC_WANDER_RADII = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const DEFAULT_WANDER_RADIUS = 3;

// Metadata keys an admin may write to an NPC; anything else is refused.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.InstancedMeshComposition,
    ObjectMetadataKeyEnumMap.Label,
    ObjectMetadataKeyEnumMap.QuarterTurns,
    ObjectMetadataKeyEnumMap.WanderRadius,
    ObjectMetadataKeyEnumMap.Personality,
];

// A character nobody plays, built as a player's is. Only an admin lays one, on a floor: its Label is its name,
// and its QuarterTurns the way it faces (see NpcGameObject). What it says, a room's script sets; in a multiplayer room
// it is a helper, which goes as far from home as its WanderRadius and is played as its Personality.
const NpcObjectTypeConfig =
{
    objectType: "Npc",
    persistent: true,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Npc,
    attachment: {
        allowedDirections: [DIR_VEC_BY_NAME["+y"]],
        standsOut: true,
    },
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        if (!RoomValidationUtil.userIsAdmin(user))
            return false;

        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        // The name it comes with must be one it could be given later.
        return LabelTextUtil.isShortName(LabelTextUtil.getText(obj));
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return RoomValidationUtil.userIsAdmin(user);
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        if (!RoomValidationUtil.userIsAdmin(user))
            return false;

        // An NPC is dragged from floor to floor by a gizmo, which is a placement rather than a motion.
        if (!signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        if (!RoomValidationUtil.userIsAdmin(user))
            return false;

        // Its Label is a name, which is short. Other values are sanitized by ObjectMetadataEntryMap.
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.Label && !LabelTextUtil.isShortName(signal.metadataValue))
            return false;
        return editableMetadataKeys.includes(signal.metadataKey);
    },
    components: {
        spawnedByAny: {
            instancedMeshGraphics: {},
            instancedMeshComposer: {
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Player,
                codecVersion: 0,
                generateDefaultParts: (obj: AddObjectSignal) => {
                    // Seeded from room and object id, so everyone sees the same character every session.
                    const hashCode = StringUtil.getHashCode(`${obj.roomID}/${obj.objectId}`);
                    return PlayerCompositionCodec.getRandomComposition(hashCode,
                        ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, obj.transform.scale));
                },
            },
            collider: {
                // A player's body, laid out as an attached object's is: across its floor, then its height.
                baseHitboxSize: {sizeX: 2 * PLAYER_RADIUS_XZ, sizeY: 2 * PLAYER_RADIUS_XZ, sizeZ: PLAYER_HEIGHT},
                applyHardCollisionToOthers: false,
                outgoingSoftCollisionForceMultiplier: 1,
                outgoingSoftCollisionForceLimit: {x: 1, y: 0, z: 1},
                incomingSoftCollisionForceMultiplier: 0, // it stands where it was put
                maxClimbableHeight: 0,
            },
            speechBubble: {
                yOffset: 0.5 * PLAYER_HEIGHT,
                checkLineOfSight: true,
                prependUserNameToMessage: true,
                // A helper's whole reply (see NPC_MESSAGE_MAX_LENGTH), in a few lines rather than a column.
                widthInChars: 28,
            },
            playerProximityDetector: { // Keeps its body from clipping through the camera's view, as a player's does.
                maxDist: 0.45,
                maxLookAngle: -1,
                maxFaceAngle: -1,
                checkLineOfSight: false,
            },
            easingMotion: {},
        },
    },
    util: {
        getWanderRadius: (obj: AddObjectSignal): number =>
        {
            return readWanderRadius(obj.metadata[ObjectMetadataKeyEnumMap.WanderRadius]?.str ?? "");
        },
        // The nearest of NPC_WANDER_RADII, or none for what is no number (see ObjectMetadataEntryMap).
        canonicalizeWanderRadius: (rawValue: string): string =>
        {
            return isNaN(parseFloat(rawValue)) ? "" : String(readWanderRadius(rawValue));
        },
        getPersonality: (obj: AddObjectSignal): NpcPersonality =>
        {
            return NpcPersonalityMap.read(obj.metadata[ObjectMetadataKeyEnumMap.Personality]?.str ?? "");
        },
    },
} satisfies ObjectTypeConfig;

function readWanderRadius(stored: string): number
{
    const parsed = parseFloat(stored);
    if (isNaN(parsed))
        return DEFAULT_WANDER_RADIUS;
    const radius = Math.min(Math.max(parsed, NPC_WANDER_RADII[0]), NPC_WANDER_RADII[NPC_WANDER_RADII.length - 1]);
    return NPC_WANDER_RADII.reduce((nearest, value) =>
        (Math.abs(value - radius) < Math.abs(nearest - radius)) ? value : nearest);
}

export default NpcObjectTypeConfig;
