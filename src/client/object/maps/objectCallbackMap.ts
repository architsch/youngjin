import RoomChangeRequestParams from "../../../shared/room/types/roomChangeRequestParams";
import GameSocketsClient from "../../networking/gameSocketsClient";
import PersistentObjectMeshInstancer from "../components/persistentObjectMeshInstancer";
import VoxelMeshInstancer from "../components/voxelMeshInstancer";
import GameObject from "../types/gameObject";

export const ObjectCallbackMap: {[callbackId: string]:
    (gameObject: GameObject, instanceId: number) => void} =
{
    "Voxel.click": (gameObject: GameObject, instanceId: number) =>
    {
        const instancer = gameObject.components.voxelMeshInstancer as VoxelMeshInstancer;
        console.log(`Selected Voxel = ${JSON.stringify(instancer.getVoxel())}\nSelected VoxelQuad = ${JSON.stringify(instancer.getVoxelQuad(instanceId))}`);
    },
    "Door.click": (gameObject: GameObject, instanceId: number) =>
    {
        const instancer = gameObject.components.persistentObjectMeshInstancer as PersistentObjectMeshInstancer;
        const po = instancer.getPersistentObject();
        console.log(`Selected PersistentObject = ${JSON.stringify(po)}`);
        
        const destinationRoomID = po.metadata;
        GameSocketsClient.tryEmitRoomChangeRequest(new RoomChangeRequestParams(destinationRoomID));
    },
}