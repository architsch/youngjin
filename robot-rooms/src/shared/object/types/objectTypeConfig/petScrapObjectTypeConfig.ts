import { PET_BODY_HEIGHT, PET_HITBOX_WIDTH } from "../../../graphics/mesh/composition/types/compositionConstants/petCompositionConstants";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../../../graphics/mesh/composition/types/instancedMeshCompositionPart";
import PetCompositionUtil from "../../../graphics/mesh/composition/util/petCompositionUtil";
import Room from "../../../room/types/room";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";
import { DIR_VEC_BY_NAME } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import { ObjectCategoryEnumMap } from "../objectCategory";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import ObjectTypeConfig from "./objectTypeConfig";

// What is left of a pet that ran out of health: its body, dark and rusted through, standing on a floor where it died
// (see PetServerUtil), the way it faced (its Facing) and still under its name (its PetIdentity). Only the server leaves
// one. The room keeps it until the pet's owner, or an admin, takes it away; anyone may move it, subject to restricted
// zones (see ObjectUpdateUtil), and a cannon ball bounces off it.
const PetScrapObjectTypeConfig =
{
    objectType: "PetScrap",
    persistent: true,
    autoUnload: true,
    category: ObjectCategoryEnumMap.PetScrap,
    attachment: {
        allowedDirections: [DIR_VEC_BY_NAME["+y"]],
        standsOut: true,
    },
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return false;
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return obj.sourceUserID == user.id || RoomValidationUtil.userIsAdmin(user);
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        // Dragged from floor to floor by a gizmo, which is a placement rather than a motion.
        return signal.ignorePhysics;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        return false;
    },
    components: {
        spawnedByAny: {
            instancedMeshGraphics: {},
            instancedMeshComposer: {
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Pet,
                codecVersion: 0,
                generateDefaultParts: (_obj: AddObjectSignal) => ({params: {}, parts: PetCompositionUtil.buildParts()}),
                deriveParts: (_obj: AddObjectSignal, parts: InstancedMeshCompositionPart[]) => {
                    PetCompositionUtil.poseScrap(parts);
                },
            },
            collider: {
                // A pet's body, laid out as an attached object's is: across its floor, then its height.
                baseHitboxSize: {sizeX: PET_HITBOX_WIDTH, sizeY: PET_HITBOX_WIDTH, sizeZ: PET_BODY_HEIGHT},
                shape: "cylinder",
                bouncesSpheres: true,
                applyHardCollisionToOthers: false,
                outgoingSoftCollisionForceMultiplier: 1,
                outgoingSoftCollisionForceLimit: {x: 1, y: 0, z: 1},
                incomingSoftCollisionForceMultiplier: 0, // it stands where it was left
                maxClimbableHeight: 0,
            },
        },
    },
} satisfies ObjectTypeConfig;

export default PetScrapObjectTypeConfig;
