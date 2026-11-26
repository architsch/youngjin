import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import PetEditOptions from "../../../ui/components/hud/selection/petEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import PetGameObject, { PET_OUTLINE_BOX_SIZE } from "../gameObject/petGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

// Anyone selects a pet, in either mode, to put something into it; its tools show its owner how to sell it too.
const PetObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new PetGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, _user, _room) => true,
        canBeSelectedByUserInPlayMode: (_gameObject, _user, _room) => true,
        outlineBoxSize: PET_OUTLINE_BOX_SIZE,
        editOptions: PetEditOptions,
    },
};

ObjectTypeClientConfigMap.setConfig("Pet", PetObjectTypeClientConfig);

export default PetObjectTypeClientConfig;
