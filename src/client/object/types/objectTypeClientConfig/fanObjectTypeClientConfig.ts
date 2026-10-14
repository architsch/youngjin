import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import FanEditOptions from "../../../ui/components/hud/selection/fanEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import FanGameObject from "../gameObject/fanGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const FanObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new FanGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, _user, _room) => true,
        editOptions: FanEditOptions,
    },
};

ObjectTypeClientConfigMap.setConfig("Fan", FanObjectTypeClientConfig);

export default FanObjectTypeClientConfig;
