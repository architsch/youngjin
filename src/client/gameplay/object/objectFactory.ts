import ObjectSpawnParams from "../../../shared/types/networking/objectSpawnParams";
import GameObject from "./types/gameObject";
import ObjectConstructorMap from "./objectConstructorMap"
import World from "../world";

let lastObjectIdNumber = 0;

const ObjectFactory =
{
    createPlayer: (world: World, x: number, z: number, angleY: number): GameObject =>
    {
        return ObjectFactory.createNewObject(world, "Player", x, z, angleY);
    },
    createWall: (world: World, x: number, z: number, angleY: number): GameObject =>
    {
        return ObjectFactory.createNewObject(world, "Wall", x, z, angleY);
    },
    createFloor: (world: World, x: number, z: number, angleY: number): GameObject =>
    {
        return ObjectFactory.createNewObject(world, "Floor", x, z, angleY);
    },
    createNewObject: (world: World, objectType: string, x: number, z: number, angleY: number): GameObject =>
    {
        const params: ObjectSpawnParams = {
            objectType,
            objectId: `${world.userName}-${Math.floor(Date.now() * 0.001)}-${++lastObjectIdNumber}`,
            x, z, angleY,
        };
        return ObjectConstructorMap[objectType](world, params, true);
    },
    createObjectFromNetwork: (world: World, params: ObjectSpawnParams): GameObject =>
    {
        return ObjectConstructorMap[params.objectType](world, params, false);
    },
}

export default ObjectFactory;