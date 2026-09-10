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
        canBeSelectedByUser: (_gameObject, user, room) =>
            RoomValidationUtil.canUserManageDoors(user, room),
        editOptions: DoorEditOptions,
        showMoveGizmos: true,
    },
};

ObjectTypeClientConfigMap.setConfig("Door", DoorObjectTypeClientConfig);

export default DoorObjectTypeClientConfig;
