import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import CannonBallGameObject from "../gameObject/cannonBallGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const CannonBallObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new CannonBallGameObject(params),
};

ObjectTypeClientConfigMap.setConfig("CannonBall", CannonBallObjectTypeClientConfig);

export default CannonBallObjectTypeClientConfig;
