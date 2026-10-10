import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import PlayerEditOptions from "../../../ui/components/hud/selection/playerEditOptions";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import PlayerGameObject from "../gameObject/playerGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const PlayerObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new PlayerGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (gameObject) => gameObject.isMine(),
        editOptions: PlayerEditOptions,
    },
};

ObjectTypeClientConfigMap.setConfig("Player", PlayerObjectTypeClientConfig);

export default PlayerObjectTypeClientConfig;
