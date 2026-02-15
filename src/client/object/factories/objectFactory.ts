import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";
import GameObject from "../types/gameObject";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import App from "../../app";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import { ObjectConstructorMap } from "../maps/objectConstructorMap";
import { ObjectMetadata } from "../../../shared/object/types/objectMetadata";

let lastObjectIdNumber = 0;

const ObjectFactory =
{
    createClientSideObject: (objectTypeIndex: number, transform: ObjectTransform, metadata: ObjectMetadata = {}): GameObject =>
    {
        const userID = App.getUser().id;
        const params = new ObjectSpawnParams(
            userID,
            objectTypeIndex,
            (++lastObjectIdNumber).toString(),
            transform,
            metadata,
        );
        const objectType = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).objectType;
        return ObjectConstructorMap[objectType](params);
    },
    createServerSideObject: (params: ObjectSpawnParams): GameObject =>
    {
        const objectType = ObjectTypeConfigMap.getConfigByIndex(params.objectTypeIndex).objectType;
        return ObjectConstructorMap[objectType](params);
    },
}

export default ObjectFactory;