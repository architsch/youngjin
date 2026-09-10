import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import LampEditOptions from "../../../ui/components/hud/selection/lampEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import LampGameObject from "../lampGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const LampObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new LampGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, user) =>
            RoomValidationUtil.userIsAdmin(user),
        editOptions: LampEditOptions,
        showMoveGizmos: true,
    },
};

ObjectTypeClientConfigMap.setConfig("Lamp", LampObjectTypeClientConfig);

export default LampObjectTypeClientConfig;
