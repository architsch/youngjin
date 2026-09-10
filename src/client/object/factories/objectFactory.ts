import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import GameObject from "../types/gameObject";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import App from "../../app";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectTypeClientConfigMap from "../maps/objectTypeClientConfigMap";
import "../maps/objectTypeClientConfigMapDependencies.ts"; // Side-effect: files every type's client config under its own type name
import { ObjectMetadata } from "../../../shared/object/types/objectMetadata";

let lastObjectIdNumber = 0;

const ObjectFactory =
{
    // This method is called when the client is instantiating an object which only belongs to the client.
    // The server, therefore, is never informed of this object's existence.
    createClientSideObject: (roomID: string, objectTypeIndex: number,
        transform: ObjectTransform, metadata: ObjectMetadata = {},
        objectId?: string): GameObject =>
    {
        const user = App.getUser();
        const obj = new AddObjectSignal(
            roomID,
            user.id,
            user.userName,
            objectTypeIndex,
            objectId ? objectId : `#${++lastObjectIdNumber}`, // If not manually set, client-only objects' IDs will be integers prefixed by "#".
            transform,
            metadata,
        );
        const objectType = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).objectType;
        return ObjectTypeClientConfigMap.getConfigByType(objectType).construct(obj);
    },
    // This method is called when the client is instantiating an object
    // whose presence is signaled by the server.
    createServerSideObject: (obj: AddObjectSignal): GameObject =>
    {
        const objectType = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).objectType;
        return ObjectTypeClientConfigMap.getConfigByType(objectType).construct(obj);
    },
}

export default ObjectFactory;