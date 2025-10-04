import ObjectSpawnParams from "../../../shared/types/gameplay/objectSpawnParams";
import World from "../world";
import Floor from "./types/floor";
import GameObject from "./types/gameObject";
import Player from "./types/player";
import Wall from "./types/wall";

const ObjectConstructorMap:
    {[objectType: string]:
        (world: World, params: ObjectSpawnParams)
            => GameObject
    } =
{
    "Player": (world: World, params: ObjectSpawnParams): GameObject => {
        return new Player(world, params.sourceUserName, params.objectId, params.transform);
    },
    "Wall": (world: World, params: ObjectSpawnParams): GameObject => {
        return new Wall(world, params.sourceUserName, params.objectId, params.transform);
    },
    "Floor": (world: World, params: ObjectSpawnParams): GameObject => {
        return new Floor(world, params.sourceUserName, params.objectId, params.transform);
    },
}

export default ObjectConstructorMap;