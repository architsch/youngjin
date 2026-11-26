import Room from "../../../room/types/room";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";
import { PET_PRICE_DOLLARS } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import { ObjectCategoryEnumMap } from "../objectCategory";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import PetBodyUtil from "../../util/petBodyUtil";
import PetTypeConfigUtil from "../../util/petTypeConfigUtil";
import ObjectTypeConfig from "./objectTypeConfig";

// A server-side pet: one an admin generated, which stays with the room it was put in rather than follow them (see
// PetObjectTypeConfig). The room keeps it, where it is and how it is (its PetNeeds), and the server plays it for as long
// as anyone is there (see PetPlayUtil), whether or not its owner is; nobody else moves it or sets anything of it. Its
// health is kept at the level it was generated with (see PetIdentity), so it never dies, and takes no wrench; anyone
// may put a battery into it (see PetInjectionUtil), and only its owner sells it.
const ServerPetObjectTypeConfig =
{
    objectType: "ServerPet",
    persistent: true,
    autoUnload: true,
    category: ObjectCategoryEnumMap.ServerPet,
    price: PET_PRICE_DOLLARS,
    movedAsBody: true,
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return RoomValidationUtil.userIsAdmin(user) && PetTypeConfigUtil.isGeneratedBy(user, room, obj, true)
            && PetBodyUtil.isClear(room, obj.transform.pos);
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return obj.sourceUserID == user.id;
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        return false;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        return obj.sourceUserID == user.id && PetTypeConfigUtil.isIdentityOfNewObject(room, obj, signal.metadataKey);
    },
    components: {
        spawnedByAny: PetTypeConfigUtil.getComponents(),
    },
} satisfies ObjectTypeConfig;

export default ServerPetObjectTypeConfig;
