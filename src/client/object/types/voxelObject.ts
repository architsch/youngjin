import Voxel from "../../../shared/voxel/voxel";
import InstancedMeshObject from "./instancedMeshObject";

let voxelObjectByInstanceId: { [instanceId: number]: VoxelObject } = {};

export default class VoxelObject extends InstancedMeshObject
{
    private voxel: Voxel | undefined;

    static get(instanceId: number): VoxelObject | undefined
    {
        return voxelObjectByInstanceId[instanceId];
    }

    getNumInstancesToRent(): number
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);
        return this.voxel.quads.length;
    }

    getMeshInstanceInfo(indexInInstanceIdsArray: number)
        : { xOffset: number, yOffset: number, zOffset: number,
            xAxisAngle: number, yAxisAngle: number, textureIndex: number }
    {
        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);
        const quad = this.voxel.quads[indexInInstanceIdsArray];

        let xOffset = 0, yOffset = quad.yOffset, zOffset = 0, xAxisAngle = 0, yAxisAngle = 0;
        switch (quad.facingAxis)
        {
            case "x":
                if (quad.orientation == "+")
                {
                    yAxisAngle = 0.5*Math.PI;
                    xOffset = 0.5;
                }
                else
                {
                    yAxisAngle = -0.5*Math.PI;
                    xOffset = -0.5;
                }
                break;
            case "y":
                if (quad.orientation == "+")
                {
                    xAxisAngle = -0.5*Math.PI;
                }
                else
                {
                    xAxisAngle = 0.5*Math.PI;
                }
                break;
            case "z":
                if (quad.orientation == "+")
                {
                    zOffset = 0.5;
                }
                else
                {
                    yAxisAngle = Math.PI;
                    zOffset = -0.5;
                }
                break;
            default:
                throw new Error(`Unknown facingAxis (${quad.facingAxis})`);
        }
        return {
            xOffset, yOffset, zOffset, xAxisAngle, yAxisAngle,
            textureIndex: quad.textureIndex,
        };
    }

    getVoxel(): Voxel
    {
        if (!this.voxel)
            throw new Error(`Voxel has not been assigned (params = ${JSON.stringify(this.params)})`);
        return this.voxel;
    }

    setVoxel(voxel: Voxel): void
    {
        this.voxel = voxel;
    }

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();

        if (this.voxel == undefined)
            throw new Error(`Voxel hasn't been defined yet.`);
        for (const instanceId of this.instanceIds)
        {
            voxelObjectByInstanceId[instanceId] = this;
        }
        if (this.instanceIds.length == 0 && this.voxel.quads.length > 0)
            console.error(`No mesh instance found in a voxel that has at least one quad in it (quads: ${JSON.stringify(this.voxel.quads)})`);
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();

        for (const instanceId of this.instanceIds)
            delete voxelObjectByInstanceId[instanceId];
    }
}