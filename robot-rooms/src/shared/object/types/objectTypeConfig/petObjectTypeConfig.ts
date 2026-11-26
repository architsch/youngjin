import Room from "../../../room/types/room";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";
import { OBJECT_MESSAGE_MAX_LENGTH, PET_PRICE_DOLLARS } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import { ObjectCategoryEnumMap } from "../objectCategory";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import MessageLinkUtil from "../../util/messageLinkUtil";
import PetBodyUtil from "../../util/petBodyUtil";
import PetIdentityUtil from "../../util/petIdentityUtil";
import PetOwnerUtil from "../../util/petOwnerUtil";
import PetRecordUtil, { MAX_PETS_PER_USER } from "../../util/petRecordUtil";
import PetTypeConfigUtil from "../../util/petTypeConfigUtil";
import ObjectTypeConfig from "./objectTypeConfig";

// A pet: a small robot its user generated, for a price, which follows them from room to room for as long as it lives
// (see PetRecordUtil). Its object is in a room only while they are, under the id their record has it by, and is played
// by its owner's browser as that plays their player (see PetDriverUtil), or by the server for an agent (see
// PetPlayUtil): moved by physics, its way told to the room now and then (see SetObjectPathSignal) rather than at
// every step, and what it shows of itself kept in its PetState. Anyone may put a battery or a wrench into it (see
// PetInjectionUtil); only its owner sells it, which removing it is (see PetSaleUtil). One that runs out of health is
// taken away by the server, and left as scrap (see PetScrapObjectTypeConfig). An admin's pets are the room's instead
// (see ServerPetObjectTypeConfig).
const PetObjectTypeConfig =
{
    objectType: "Pet",
    persistent: false,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Pet,
    price: PET_PRICE_DOLLARS,
    // One its user owns already comes in after them for nothing.
    getPrice: (room: Room, obj: AddObjectSignal) => {
        return (PetOwnerUtil.findRecord(room, obj.sourceUserID, obj.objectId) != undefined) ? 0 : PET_PRICE_DOLLARS;
    },
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        if (!PetTypeConfigUtil.isGeneratedBy(user, room, obj, false) || !PetRecordUtil.isPetId(obj.objectId))
            return false;
        // A pet comes with its owner, who holds the record of it.
        const player = PetOwnerUtil.findPlayer(room, user.id);
        if (player == undefined)
            return false;
        const records = PetRecordUtil.getPlayerRecords(player);
        const record = records.find(owned => owned.petId == obj.objectId);
        // One of theirs is who their record says it is, and comes in wherever whoever plays it has it: behind the door
        // its owner came by, in the wall (see PetEntranceUtil). Any other is a new one, which needs somewhere clear to
        // stand and room in their record, and which an admin generates for the room instead.
        if (record != undefined)
            return PetIdentityUtil.encode(record.identity) == obj.metadata[ObjectMetadataKeyEnumMap.PetIdentity]?.str;
        return PetBodyUtil.isClear(room, obj.transform.pos) && records.length < MAX_PETS_PER_USER
            && !RoomValidationUtil.userIsAdmin(user);
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return obj.sourceUserID == user.id;
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        // Moved by physics alone, as its owner's browser steps it.
        return obj.sourceUserID == user.id && !signal.ignorePhysics;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        if (obj.sourceUserID != user.id)
            return false;
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.SentMessage)
            return MessageLinkUtil.getVisibleLength(signal.metadataValue.trim()) <= OBJECT_MESSAGE_MAX_LENGTH;
        return signal.metadataKey == ObjectMetadataKeyEnumMap.PetState
            || PetTypeConfigUtil.isIdentityOfNewObject(room, obj, signal.metadataKey);
    },
    components: {
        spawnedByAny: PetTypeConfigUtil.getComponents(),
        spawnedByMe: {
            rigidbody: {},
        },
    },
} satisfies ObjectTypeConfig;

export default PetObjectTypeConfig;
