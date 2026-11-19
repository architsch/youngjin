import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import { volumesShownObservable } from "../../../system/clientObservables";
import VolumeEditOptions from "../../../ui/components/hud/selection/volumeEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import VolumeGameObject from "../gameObject/volumeGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const VolumeObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new VolumeGameObject(params),
    selection: {
        // Whoever may edit one (see VolumeObjectTypeConfig), while volumes show (see volumesShownObservable).
        canBeSelectedByUserInEditMode: (_gameObject, user, room) => volumesShownObservable.peek()
            && (RoomValidationUtil.userIsAdmin(user) || RoomValidationUtil.isRoomSuperuser(user, room)),
        editOptions: VolumeEditOptions,
        selectedByOwnControl: true,
    },
};

ObjectTypeClientConfigMap.setConfig("Volume", VolumeObjectTypeClientConfig);

export default VolumeObjectTypeClientConfig;
