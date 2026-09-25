import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import LabelEditOptions from "../../../ui/components/hud/selection/labelEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import LabelGameObject from "../labelGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const LabelObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new LabelGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, user, room) =>
            RoomValidationUtil.isRoomSuperuser(user, room),
        editOptions: LabelEditOptions,
        editPanels: ["labelText", "compositionThumbnail"],
    },
};

ObjectTypeClientConfigMap.setConfig("Label", LabelObjectTypeClientConfig);

export default LabelObjectTypeClientConfig;
