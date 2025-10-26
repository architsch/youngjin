import ObjectSpawnParams from "../../shared/object/objectSpawnParams";
import GameObject from "./types/gameObject";
import Player from "./types/player";
import VoxelObject from "./types/voxelObject";

const ObjectConstructorMap: {[objectType: string]: (params: ObjectSpawnParams) => GameObject} =
{
    "Player": (params: ObjectSpawnParams): GameObject => new Player(params),
    "VoxelObject": (params: ObjectSpawnParams): GameObject => new VoxelObject(params),
}

export default ObjectConstructorMap;