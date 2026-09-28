import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import CanvasEditOptions from "../../../ui/components/hud/selection/canvasEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import CanvasGameObject from "../gameObject/canvasGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const CanvasObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new CanvasGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, _user, _room) => true,
        editOptions: CanvasEditOptions,
        editPanels: ["compositionThumbnail", "imageMapThumbnail"],
    },
};

ObjectTypeClientConfigMap.setConfig("Canvas", CanvasObjectTypeClientConfig);

export default CanvasObjectTypeClientConfig;
