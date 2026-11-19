import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import PropEditOptions from "../../../ui/components/hud/selection/propEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import PropGameObject from "../gameObject/propGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const PropObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new PropGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, _user, _room) => true,
        editOptions: PropEditOptions,
        editPanels: ["imageMapThumbnail"],
    },
};

ObjectTypeClientConfigMap.setConfig("Prop", PropObjectTypeClientConfig);

export default PropObjectTypeClientConfig;
