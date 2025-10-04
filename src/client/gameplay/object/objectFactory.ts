import ObjectSpawnParams from "../../../shared/types/gameplay/objectSpawnParams";
import GameObject from "./types/gameObject";
import ObjectConstructorMap from "./objectConstructorMap";
import World from "../world";
import ObjectTransform from "../../../shared/types/gameplay/objectTransform";

let lastObjectIdNumber = 0;

const ObjectFactory =
{
    createPlayer: (world: World, transform: ObjectTransform): GameObject =>
    {
        return ObjectFactory.createNewObject(world, "Player", transform);
    },
    createWall: (world: World, transform: ObjectTransform): GameObject =>
    {
        return ObjectFactory.createNewObject(world, "Wall", transform);
    },
    createFloor: (world: World, transform: ObjectTransform): GameObject =>
    {
        return ObjectFactory.createNewObject(world, "Floor", transform);
    },
    createNewObject: (world: World, objectType: string, transform: ObjectTransform): GameObject =>
    {
        const params: ObjectSpawnParams = {
            sourceUserName: world.userName,
            objectType,
            objectId: `${world.userName}-${Math.floor(Date.now() * 0.001)}-${++lastObjectIdNumber}`,
            transform,
        };
        const objectConstructor = ObjectConstructorMap[objectType];
        if (objectConstructor == undefined)
            throw new Error(`objectConstructor not found (objectType = ${objectType})`);
        return objectConstructor(world, params);
    },
    createObjectFromNetwork: (world: World, params: ObjectSpawnParams): GameObject =>
    {
        const objectConstructor = ObjectConstructorMap[params.objectType];
        if (objectConstructor == undefined)
            throw new Error(`objectConstructor not found (params.objectType = ${params.objectType})`);
        return objectConstructor(world, params);
    },
}

export default ObjectFactory;