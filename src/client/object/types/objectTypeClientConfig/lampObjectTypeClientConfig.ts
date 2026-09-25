import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import LampEditOptions from "../../../ui/components/hud/selection/lampEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import LampGameObject from "../lampGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const LampObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new LampGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, _user, _room) => true,
        editOptions: LampEditOptions,
        editPanels: ["compositionThumbnail"],
    },
};

ObjectTypeClientConfigMap.setConfig("Lamp", LampObjectTypeClientConfig);

export default LampObjectTypeClientConfig;
