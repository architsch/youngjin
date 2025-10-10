import ObjectSpawnParams from "../../shared/types/object/objectSpawnParams";
import GameObject from "./types/gameObject";
import ObjectConstructorMap from "./objectConstructorMap";
import ObjectTransform from "../../shared/types/object/objectTransform";
import App from "../app";

let lastObjectIdNumber = 0;

const ObjectFactory =
{
    createNewObject: (objectType: string, transform: ObjectTransform,
        metadata: { [key: string]: string | number } = {}): GameObject =>
    {
        const userName = App.getEnv().user.userName;
        const params: ObjectSpawnParams = {
            sourceUserName: userName,
            objectType,
            objectId: `${userName}-${Math.floor(Date.now() * 0.001)}-${++lastObjectIdNumber}`,
            transform,
            metadata,
        };
        const objectConstructor = ObjectConstructorMap[objectType];
        if (objectConstructor == undefined)
            throw new Error(`objectConstructor not found (objectType = ${objectType})`);
        return objectConstructor(params);
    },
    createObjectFromNetwork: (params: ObjectSpawnParams): GameObject =>
    {
        const objectConstructor = ObjectConstructorMap[params.objectType];
        if (objectConstructor == undefined)
            throw new Error(`objectConstructor not found (params.objectType = ${params.objectType})`);
        return objectConstructor(params);
    },
}

export default ObjectFactory;