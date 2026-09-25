import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import DoorEditOptions from "../../../ui/components/hud/selection/doorEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import DoorGameObject from "../doorGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const DoorObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new DoorGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, user, room) =>
            RoomValidationUtil.isRoomSuperuser(user, room),
        editOptions: DoorEditOptions,
        editPanels: ["labelText", "compositionThumbnail"],
    },
};

ObjectTypeClientConfigMap.setConfig("Door", DoorObjectTypeClientConfig);

export default DoorObjectTypeClientConfig;
