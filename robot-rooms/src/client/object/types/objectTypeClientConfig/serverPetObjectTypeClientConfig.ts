import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import PetEditOptions from "../../../ui/components/hud/selection/petEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import PetGameObject, { PET_OUTLINE_BOX_SIZE } from "../gameObject/petGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

// Drawn as any pet is (see PetObjectTypeClientConfig), and selected by admins alone: nothing goes into one, its health
// and its charge being kept where they are, and only the admin who generated it removes it.
const ServerPetObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new PetGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, user, _room) => RoomValidationUtil.userIsAdmin(user),
        canBeSelectedByUserInPlayMode: (_gameObject, user, _room) => RoomValidationUtil.userIsAdmin(user),
        outlineBoxSize: PET_OUTLINE_BOX_SIZE,
        editOptions: PetEditOptions,
    },
};

ObjectTypeClientConfigMap.setConfig("ServerPet", ServerPetObjectTypeClientConfig);

export default ServerPetObjectTypeClientConfig;
