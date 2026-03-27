import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
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
        const obj = new AddObjectSignal(
            roomID,
            user.id,
            user.userName,
            objectTypeIndex,
            `#${++lastObjectIdNumber}`, // Client-only objects are prefixed by "#".
            transform,
            metadata,
        );
        const objectType = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).objectType;
        return ObjectConstructorMap[objectType](obj);
    },
    // This method is called when the client is instantiating an object
    // whose presence is signaled by the server.
    createServerSideObject: (obj: AddObjectSignal): GameObject =>
    {
        const objectType = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).objectType;
        return ObjectConstructorMap[objectType](obj);
    },
}

export default ObjectFactory;