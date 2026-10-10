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
import ObjectTypeConfig from "./objectTypeConfig";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "./playerObjectTypeConfig";

// Metadata keys an admin may write to an NPC; anything else is refused.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.InstancedMeshComposition,
    ObjectMetadataKeyEnumMap.Label,
    ObjectMetadataKeyEnumMap.QuarterTurns,
];

// A character nobody plays, built as a player's is. Only an admin lays one, on a floor: its Label is its name,
// and its QuarterTurns the way it faces (see NpcGameObject). What it says, a room's script sets.
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
} satisfies ObjectTypeConfig;

export default NpcObjectTypeConfig;
