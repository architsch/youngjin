import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import LampEditOptions from "../../../ui/components/hud/selection/lampEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import WallLampGameObject from "../wallLampGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const WallLampObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new WallLampGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, _user, _room) => true,
        editOptions: LampEditOptions,
        showMoveGizmos: true,
    },
};

ObjectTypeClientConfigMap.setConfig("WallLamp", WallLampObjectTypeClientConfig);

export default WallLampObjectTypeClientConfig;
