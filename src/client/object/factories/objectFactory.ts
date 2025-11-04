import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";
import GameObject from "../types/gameObject";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import App from "../../app";

let lastObjectIdNumber = 0;

const ObjectFactory =
{
    createClientSideObject: (objectTypeIndex: number, transform: ObjectTransform, metadata: string = ""): GameObject =>
    {
        const userName = App.getEnv().user.userName;
        const params: ObjectSpawnParams = {
            sourceUserName: userName,
            objectTypeIndex,
            objectId: (++lastObjectIdNumber).toString(),
            transform,
            metadata,
        };
        return new GameObject(params);
    },
    createServerSideObject: (params: ObjectSpawnParams): GameObject =>
    {
        return new GameObject(params);
    },
}

export default ObjectFactory;