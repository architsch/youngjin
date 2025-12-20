import GameObjectComponent from "./gameObjectComponent";
import Voxel from "../../../shared/voxel/types/voxel";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import GameObject from "../types/gameObject";
import VoxelQuad from "../../../shared/voxel/types/voxelQuad";
import VoxelQuadChange from "../../../shared/voxel/types/voxelQuadChange";
import App from "../../app";

let isDevMode: boolean | undefined;
let debug_str: string;

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

        if (isDevMode === undefined)
            isDevMode = App.getEnv().mode == "dev";
    }

    async onSpawn(): Promise<void>
    {        
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);

        for (const quad of this.voxel.quads)
        {
            const instanceId = await this.instancedMeshGraphics.loadInstance();
            this.updateVoxelQuadInstance(instanceId, quad);
        }
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
        voxel.setGameObjectId(this.gameObject.params.objectId);
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

    async applyVoxelQuadChange(voxelQuadChange: VoxelQuadChange)
    {
        if (!this.instancedMeshGraphics)
        {
            console.error(`InstancedMeshGraphics is not set (voxelQuadChange: ${JSON.stringify(voxelQuadChange)})`);
            return;
        }
        const instanceIds = this.instancedMeshGraphics.instanceIds;
        if (isDevMode)
            debug_str = `${String(voxelQuadChange)}\n    -> `;

        switch (voxelQuadChange.actionType)
        {
            case "add":
                const newInstanceId = await this.instancedMeshGraphics.loadInstance();
                this.updateVoxelQuadInstance(newInstanceId, voxelQuadChange);
                if (isDevMode)
                    debug_str += `newInstanceId: ${newInstanceId} -> instanceIds: ${instanceIds}`;
                break;
            case "remove":
                const oldInstanceId = instanceIds[voxelQuadChange.quadIndex];
                this.instancedMeshGraphics.unloadInstance(oldInstanceId);
                if (isDevMode)
                    debug_str += `oldInstanceId: ${oldInstanceId} -> instanceIds: ${instanceIds}`;
                break;
            case "changeTexture":
                const existingInstanceId = instanceIds[voxelQuadChange.quadIndex];
                this.instancedMeshGraphics.updateInstanceTextureIndex(existingInstanceId, voxelQuadChange.textureIndex);
                if (isDevMode)
                    debug_str += `existingInstanceId: ${existingInstanceId} -> instanceIds: ${instanceIds}`;
                break;
            default:
                throw new Error(`Unknown VoxelQuadChange actionType :: ${voxelQuadChange.actionType}`);
        }
        if (isDevMode)
            console.log(debug_str);
    }

    private updateVoxelQuadInstance(instanceId: number, info: VoxelQuad | VoxelQuadChange)
    {
        let xOffset = 0, yOffset = info.yOffset, zOffset = 0, dirX = 0, dirY = 0, dirZ = 0;
        switch (info.facingAxis)
        {
            case "x":
                if (info.orientation == "+")
                {
                    dirX = 1; dirY = 0; dirZ = 0;
                    xOffset = 0.5;
                }
                else
                {
                    dirX = -1; dirY = 0; dirZ = 0;
                    xOffset = -0.5;
                }
                break;
            case "y":
                if (info.orientation == "+")
                {
                    dirX = 0; dirY = 1; dirZ = 0;
                }
                else
                {
                    dirX = 0; dirY = -1; dirZ = 0;
                }
                break;
            case "z":
                if (info.orientation == "+")
                {
                    dirX = 0; dirY = 0; dirZ = 1;
                    zOffset = 0.5;
                }
                else
                {
                    dirX = 0; dirY = 0; dirZ = -1;
                    zOffset = -0.5;
                }
                break;
            default:
                throw new Error(`Unknown facingAxis (${info.facingAxis})`);
        }
        this.instancedMeshGraphics.updateInstanceTransform(instanceId, xOffset, yOffset, zOffset, dirX, dirY, dirZ);
        this.instancedMeshGraphics.updateInstanceTextureIndex(instanceId, info.textureIndex);
    }
}