import ObjectSpawnParams from "../../../shared/types/networking/objectSpawnParams";
import World from "../world";
import Floor from "./types/floor";
import GameObject from "./types/gameObject";
import Player from "./types/player";
import Wall from "./types/wall";

const ObjectConstructorMap:
    {[objectType: string]:
        (world: World, params: ObjectSpawnParams, mine: boolean)
            => GameObject
    } =
{
    "Player": (world: World, params: ObjectSpawnParams, mine: boolean) => {
        return new Player(world, params.objectId, params.transform, mine);
    },
    "Wall": (world: World, params: ObjectSpawnParams, mine: boolean) => {
        return new Wall(world, params.objectId, params.transform);
    },
    "Floor": (world: World, params: ObjectSpawnParams, mine: boolean) => {
        return new Floor(world, params.objectId, params.transform);
    },
}

export default ObjectConstructorMap;