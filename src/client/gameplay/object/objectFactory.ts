import ObjectSpawnParams from "../../../shared/types/networking/objectSpawnParams";
import GameObject from "./types/gameObject";
import ObjectConstructorMap from "./objectConstructorMap"
import World from "../world";
import ObjectTransform from "../../../shared/types/networking/objectTransform";

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
            objectType,
            objectId: `${world.userName}-${Math.floor(Date.now() * 0.001)}-${++lastObjectIdNumber}`,
            transform,
        };
        return ObjectConstructorMap[objectType](world, params, true);
    },
    createObjectFromNetwork: (world: World, params: ObjectSpawnParams): GameObject =>
    {
        return ObjectConstructorMap[params.objectType](world, params, false);
    },
}

export default ObjectFactory;