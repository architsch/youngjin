import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import CannonEditOptions from "../../../ui/components/hud/selection/cannonEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import CannonGameObject from "../gameObject/cannonGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

// Selected in either mode, for its switch, or once it is scrap, to turn it or take it away.
const CannonObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new CannonGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, _user, _room) => true,
        canBeSelectedByUserInPlayMode: (_gameObject, _user, _room) => true,
        editOptions: CannonEditOptions,
    },
};

ObjectTypeClientConfigMap.setConfig("Cannon", CannonObjectTypeClientConfig);

export default CannonObjectTypeClientConfig;
