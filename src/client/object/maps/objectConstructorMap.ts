import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import GameObject from "../types/gameObject";
import VoxelGameObject from "../types/voxelGameObject";
import PlayerGameObject from "../types/playerGameObject";
import CanvasGameObject from "../types/canvasGameObject";

export const ObjectConstructorMap: {[objectType: string]:
    (params: AddObjectSignal) => GameObject} =
{
    "Voxel": (params: AddObjectSignal): GameObject => new VoxelGameObject(params),
    "Player": (params: AddObjectSignal): GameObject => new PlayerGameObject(params),
    "Canvas": (params: AddObjectSignal): GameObject => new CanvasGameObject(params),
}