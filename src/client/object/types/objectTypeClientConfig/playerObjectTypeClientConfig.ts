import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import CustomizePlayerForm from "../../../ui/components/form/customizePlayerForm";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import PlayerGameObject from "../playerGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const PlayerObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new PlayerGameObject(params),
    selection: {
        canBeSelectedByUserInEditMode: (gameObject) => gameObject.isMine(),
        editOptions: CustomizePlayerForm,
    },
};

ObjectTypeClientConfigMap.setConfig("Player", PlayerObjectTypeClientConfig);

export default PlayerObjectTypeClientConfig;
