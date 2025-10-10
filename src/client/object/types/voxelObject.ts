import Voxel from "../../voxel/voxel";
import VoxelManager from "../../voxel/voxelManager";
import InstancedMeshObject from "./instancedMeshObject";

export default abstract class VoxelObject extends InstancedMeshObject
{
    private voxel: Voxel | undefined;

    getVoxel(): Voxel
    {
        if (!this.voxel)
            throw new Error(`Voxel has not been assigned (params = ${JSON.stringify(this.params)})`);
        return this.voxel;
    }

    setVoxel(voxel: Voxel): void
    {
        this.voxel = voxel;
        VoxelManager.registerVoxelByMeshInstanceId(this.getMeshInstanceId(), voxel);
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();

        VoxelManager.unregisterVoxelByMeshInstanceId(this.getMeshInstanceId());
    }
}