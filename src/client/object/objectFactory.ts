import ObjectSpawnParams from "../../shared/object/objectSpawnParams";
import GameObject from "./types/gameObject";
import { ClientSideObjectConstructorMap, ServerSideObjectConstructorMap } from "./objectConstructorMap";
import ObjectTransform from "../../shared/object/objectTransform";
import App from "../app";

let lastObjectIdNumber = 0;

const ObjectFactory =
{
    createClientSideObject: (objectType: string, transform: ObjectTransform,
        metadata: { [key: string]: any } = {}): GameObject =>
    {
        const userName = App.getEnv().user.userName;
        const params: ObjectSpawnParams = {
            sourceUserName: userName,
            objectType,
            objectId: (++lastObjectIdNumber).toString(),
            transform,
            metadata,
        };
        const objectConstructor = ClientSideObjectConstructorMap[objectType];
        if (objectConstructor == undefined)
            throw new Error(`Client-side objectConstructor not found (objectType = ${objectType})`);
        return objectConstructor(params);
    },
    createServerSideObject: (params: ObjectSpawnParams): GameObject =>
    {
        const objectConstructor = ServerSideObjectConstructorMap[params.objectType];
        if (objectConstructor == undefined)
            throw new Error(`Server-side objectConstructor not found (params.objectType = ${params.objectType})`);
        return objectConstructor(params);
    },
}

export default ObjectFactory;