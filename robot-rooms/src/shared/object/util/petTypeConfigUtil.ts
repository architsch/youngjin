import { PET_BODY_HEIGHT, PET_CLIMB_LAYERS, PET_HITBOX_WIDTH,
    PET_HOP_HEIGHT } from "../../graphics/mesh/composition/types/compositionConstants/petCompositionConstants";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../../graphics/mesh/composition/types/instancedMeshCompositionPart";
import PetCompositionUtil from "../../graphics/mesh/composition/util/petCompositionUtil";
import Room from "../../room/types/room";
import { RoomTypeEnumMap } from "../../room/types/roomType";
import { COLLISION_LAYER_HEIGHT } from "../../system/sharedConstants";
import User from "../../user/types/user";
import AddObjectSignal from "../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import ObjectTypeConfig from "../types/objectTypeConfig/objectTypeConfig";
import PetIdentityUtil from "./petIdentityUtil";
import PetShownStateUtil, { PET_RUST_LEVELS } from "./petShownStateUtil";

type SharedComponents = NonNullable<ObjectTypeConfig["components"]["spawnedByAny"]>;

// What the two types of living pet share (see PetObjectTypeConfig, ServerPetObjectTypeConfig). Read as those configs
// are made, so it imports nothing that leads back to them.
const PetTypeConfigUtil =
{
    // A body like a player's, lower: round to a cannon ball, pushed about by other bodies and pushing them, and up
    // two blocks' height as it goes, where a player climbs one (see PET_CLIMB_LAYERS).
    getComponents: (): SharedComponents =>
    {
        return {
            instancedMeshGraphics: {},
            instancedMeshComposer: {
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Pet,
                codecVersion: 0,
                generateDefaultParts: (_obj: AddObjectSignal) => ({params: {}, parts: PetCompositionUtil.buildParts()}),
                // Its color is who it is; its rust, its charge and its face are what its state shows of it (see
                // PetGameObject).
                deriveParts: (obj: AddObjectSignal, parts: InstancedMeshCompositionPart[]) => {
                    PetCompositionUtil.paint(parts, PetIdentityUtil.getBodyColor(PetIdentityUtil.getObjectIdentity(obj)));
                    const shown = PetShownStateUtil.getObjectState(obj);
                    PetCompositionUtil.pose(parts, shown.rust, PET_RUST_LEVELS, shown.batteryLevel, shown.expression,
                        shown.sleepy, shown.powerless);
                },
            },
            collider: {
                baseHitboxSize: {sizeX: PET_HITBOX_WIDTH, sizeY: PET_BODY_HEIGHT, sizeZ: PET_HITBOX_WIDTH},
                shape: "cylinder",
                applyHardCollisionToOthers: false,
                outgoingSoftCollisionForceMultiplier: 1,
                outgoingSoftCollisionForceLimit: {x: 1, y: 0, z: 1},
                incomingSoftCollisionForceMultiplier: 1,
                maxClimbableHeight: PET_CLIMB_LAYERS * COLLISION_LAYER_HEIGHT + 0.1, // a little more than the blocks
            },
            speechBubble: {
                yOffset: 0.5 * PET_BODY_HEIGHT + PET_HOP_HEIGHT,
                checkLineOfSight: true,
                prependUserNameToMessage: true,
            },
            easingMotion: {},
        };
    },
    // Whether the object is a pet a user may generate: their own, in a room the server keeps, named, of traits that
    // read back as written, and with both its health and its charge kept where they are if it is one a room keeps, and
    // only then.
    isGeneratedBy: (user: User, room: Room, obj: AddObjectSignal, keptByRoom: boolean): boolean =>
    {
        const identity = obj.metadata[ObjectMetadataKeyEnumMap.PetIdentity]?.str ?? "";
        const decoded = PetIdentityUtil.decode(identity);
        return obj.sourceUserID == user.id && room.roomType != RoomTypeEnumMap.SinglePlayer
            && PetIdentityUtil.isComplete(identity)
            && (PetIdentityUtil.getFixedHealth(decoded) != undefined) == keptByRoom
            && (PetIdentityUtil.getFixedEnergy(decoded) != undefined) == keptByRoom;
    },
    // A pet's identity is set as it is generated, and never after.
    isIdentityOfNewObject: (room: Room, obj: AddObjectSignal, metadataKey: number): boolean =>
    {
        return metadataKey == ObjectMetadataKeyEnumMap.PetIdentity && room.objectById[obj.objectId] == undefined;
    },
}

export default PetTypeConfigUtil;
