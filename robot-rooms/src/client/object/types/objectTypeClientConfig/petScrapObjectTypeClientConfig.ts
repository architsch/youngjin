import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import RemovableEditOptions from "../../../ui/components/hud/selection/removableEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import PetScrapGameObject from "../gameObject/petScrapGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const PetScrapObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new PetScrapGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, _user, _room) => true,
        editOptions: RemovableEditOptions,
    },
};

ObjectTypeClientConfigMap.setConfig("PetScrap", PetScrapObjectTypeClientConfig);

export default PetScrapObjectTypeClientConfig;
