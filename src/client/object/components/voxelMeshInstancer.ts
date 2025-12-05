import GameObjectComponent from "./gameObjectComponent";
import Voxel from "../../../shared/voxel/types/voxel";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import GameObject from "../types/gameObject";
import VoxelQuad from "../../../shared/voxel/types/voxelQuad";

export default class VoxelMeshInstancer extends GameObjectComponent
{
    instancedMeshGraphics: InstancedMeshGraphics;

    private voxel: Voxel | undefined;

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);

        this.instancedMeshGraphics = this.gameObject.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("VoxelMeshInstancer requires InstancedMeshGraphics component");
    }

    async onSpawn(): Promise<void>
    {        
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);
        if (this.instancedMeshGraphics!.instanceIds.length == 0 && this.voxel.quads.length > 0)
            console.error(`No mesh instance found in a voxel that has at least one quad in it (quads: ${JSON.stringify(this.voxel.quads)})`);
    }

    getVoxel(): Voxel
    {
        if (!this.voxel)
            throw new Error(`Voxel has not been assigned (params = ${JSON.stringify(this.gameObject.params)})`);
        return this.voxel;
    }

    setVoxel(voxel: Voxel): void
    {
        this.voxel = voxel;
    }

    getVoxelQuad(instanceId: number): { voxelQuad: VoxelQuad, quadIndex: number }
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);
        const instanceIds = this.instancedMeshGraphics!.instanceIds;

        for (let quadIndex = 0; quadIndex < instanceIds.length; ++quadIndex)
        {
            if (instanceIds[quadIndex] == instanceId)
                return { voxelQuad: this.voxel.quads[quadIndex], quadIndex };
        }
        throw new Error(`VoxelQuad not found (instanceId = ${instanceId}, instanceIds = ${JSON.stringify(instanceIds)})`);
    }
}