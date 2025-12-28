import * as THREE from "three";
import GameObject from "./gameObject";
import VoxelMeshInstancer from "../components/voxelMeshInstancer";
import ObjectManager from "../objectManager";
import VoxelQuadSelection from "../../graphics/types/gizmo/voxelQuadSelection";

export default class VoxelGameObject extends GameObject
{
    onClick(instanceId: number, hitPoint: THREE.Vector3)
    {
        const player = ObjectManager.getMyPlayer();
        if (player == undefined)
        {
            console.error("My player not found in VoxelGameObject's onClick.");
            return;
        }
        const distSqr = hitPoint.distanceToSquared(player.position);
        if (distSqr > 256)
            return;

        const instancer = this.components.voxelMeshInstancer as VoxelMeshInstancer;
        const voxel = instancer.getVoxel();
        const quadIndex = instancer.getVoxelQuadIndexAtInstance(instanceId);
        VoxelQuadSelection.trySelect(voxel, quadIndex);
    }
}