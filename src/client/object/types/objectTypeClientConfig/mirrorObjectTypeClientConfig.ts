import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import MirrorEditOptions from "../../../ui/components/hud/selection/mirrorEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import MirrorGameObject from "../gameObject/mirrorGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const MirrorObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new MirrorGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, user, _room) => RoomValidationUtil.userIsAdmin(user),
        editOptions: MirrorEditOptions,
        editPanels: ["compositionThumbnail"],
    },
};

ObjectTypeClientConfigMap.setConfig("Mirror", MirrorObjectTypeClientConfig);

export default MirrorObjectTypeClientConfig;
