import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import CannonEditOptions from "../../../ui/components/hud/selection/cannonEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import CannonGameObject from "../gameObject/cannonGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const CannonObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new CannonGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, _user, _room) => true,
        editOptions: CannonEditOptions,
    },
};

ObjectTypeClientConfigMap.setConfig("Cannon", CannonObjectTypeClientConfig);

export default CannonObjectTypeClientConfig;
