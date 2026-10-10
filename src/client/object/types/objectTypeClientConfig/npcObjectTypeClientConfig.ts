import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import PlayerEditOptions from "../../../ui/components/hud/selection/playerEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import NpcGameObject from "../gameObject/npcGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const NpcObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new NpcGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (_gameObject, user, _room) => RoomValidationUtil.userIsAdmin(user),
        editOptions: PlayerEditOptions,
        editPanels: ["playerParts"],
    },
};

ObjectTypeClientConfigMap.setConfig("Npc", NpcObjectTypeClientConfig);

export default NpcObjectTypeClientConfig;
