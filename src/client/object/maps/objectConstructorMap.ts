import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";
import GameObject from "../types/gameObject";
import VoxelGameObject from "../types/voxelGameObject";
import PlayerGameObject from "../types/playerGameObject";
import CanvasGameObject from "../types/canvasGameObject";

export const ObjectConstructorMap: {[objectType: string]:
    (params: ObjectSpawnParams) => GameObject} =
{
    "Voxel": (params: ObjectSpawnParams): GameObject => new VoxelGameObject(params),
    "Player": (params: ObjectSpawnParams): GameObject => new PlayerGameObject(params),
    "Canvas": (params: ObjectSpawnParams): GameObject => new CanvasGameObject(params),
}