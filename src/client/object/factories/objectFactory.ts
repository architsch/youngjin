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
    // This method is called when the client is instantiating an object which only belongs to the client.
    // The server, therefore, is never informed of this object's existence.
    createClientSideObject: (roomID: string, objectTypeIndex: number, transform: ObjectTransform, metadata: ObjectMetadata = {}): GameObject =>
    {
        const user = App.getUser();
        const params = new ObjectSpawnParams(
            roomID,
            user.id,
            user.userName,
            objectTypeIndex,
            (++lastObjectIdNumber).toString(),
            transform,
            metadata,
        );
        const objectType = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).objectType;
        return ObjectConstructorMap[objectType](params);
    },
    // This method is called when the client is instantiating an object
    // that was spawned by the server.
    createServerSideObject: (params: ObjectSpawnParams): GameObject =>
    {
        const objectType = ObjectTypeConfigMap.getConfigByIndex(params.objectTypeIndex).objectType;
        return ObjectConstructorMap[objectType](params);
    },
}

export default ObjectFactory;