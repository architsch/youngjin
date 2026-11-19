import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import DollarBillGameObject from "../gameObject/dollarBillGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

const DollarBillObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new DollarBillGameObject(params),
};

ObjectTypeClientConfigMap.setConfig("DollarBill", DollarBillObjectTypeClientConfig);

export default DollarBillObjectTypeClientConfig;
