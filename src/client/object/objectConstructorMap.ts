import ObjectSpawnParams from "../../shared/object/objectSpawnParams";
import GameObject from "./types/gameObject";
import Player from "./types/player";
import VoxelObject from "./types/voxelObject";

export const ClientSideObjectConstructorMap: {[objectType: string]: (params: ObjectSpawnParams) => GameObject} =
{
    "VoxelObject": (params: ObjectSpawnParams): GameObject => new VoxelObject(params),
}

export const ServerSideObjectConstructorMap: {[objectType: string]: (params: ObjectSpawnParams) => GameObject} =
{
    "Player": (params: ObjectSpawnParams): GameObject => new Player(params),
}