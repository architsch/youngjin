import * as THREE from "three";
import RoomChangeRequestParams from "../../../shared/room/types/roomChangeRequestParams";
import GameSocketsClient from "../../networking/gameSocketsClient";
import PersistentObjectMeshInstancer from "../components/persistentObjectMeshInstancer";
import PlayerProximityDetector from "../components/playerProximityDetector";
import VoxelMeshInstancer from "../components/voxelMeshInstancer";
import GameObject from "../types/gameObject";

export const ObjectClickCallbackMap: {[objectType: string]:
    (gameObject: GameObject, instanceId: number, hitPoint: THREE.Vector3) => void} =
{
    "Voxel": (gameObject: GameObject, instanceId: number, hitPoint: THREE.Vector3) =>
    {
        const instancer = gameObject.components.voxelMeshInstancer as VoxelMeshInstancer;
        console.log(`Selected Voxel = ${JSON.stringify(instancer.getVoxel())}\nSelected VoxelQuad = ${JSON.stringify(instancer.getVoxelQuad(instanceId))}`);
    },
    "Door": (gameObject: GameObject, instanceId: number, hitPoint: THREE.Vector3) =>
    {
        const detector = gameObject.components.playerProximityDetector as PlayerProximityDetector;
        if (!detector.isProximityOn())
            return;

        const instancer = gameObject.components.persistentObjectMeshInstancer as PersistentObjectMeshInstancer;
        const po = instancer.getPersistentObject();
        console.log(`Selected PersistentObject = ${JSON.stringify(po)}`);
        
        const destinationRoomID = po.metadata;
        GameSocketsClient.tryEmitRoomChangeRequest(new RoomChangeRequestParams(destinationRoomID));
    },
}