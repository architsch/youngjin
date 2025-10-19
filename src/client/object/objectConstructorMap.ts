import ObjectSpawnParams from "../../shared/object/objectSpawnParams";
import Floor from "./types/floor";
import GameObject from "./types/gameObject";
import Player from "./types/player";
import Wall from "./types/wall";

const ObjectConstructorMap: {[objectType: string]: (params: ObjectSpawnParams) => GameObject} =
{
    "Player": (params: ObjectSpawnParams): GameObject => new Player(params),
    "Wall": (params: ObjectSpawnParams): GameObject => new Wall(params),
    "Floor": (params: ObjectSpawnParams): GameObject => new Floor(params),
}

export default ObjectConstructorMap;