import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import LampEditOptions from "../../../ui/components/hud/selection/lampEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import WallLampGameObject from "../wallLampGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const WallLampObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new WallLampGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, user) =>
            RoomValidationUtil.userIsAdmin(user),
        editOptions: LampEditOptions,
        showMoveGizmos: true,
    },
};

ObjectTypeClientConfigMap.setConfig("WallLamp", WallLampObjectTypeClientConfig);

export default WallLampObjectTypeClientConfig;
