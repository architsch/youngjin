import GameObjectComponent from "./gameObjectComponent";
import MaterialParams from "../../graphics/types/material/materialParams";
import InstancedMeshBinding from "../../graphics/types/mesh/instancedMeshBinding";
import InstancedMeshIdUtil from "../../../shared/graphics/mesh/util/instancedMeshIdUtil";

// instancedMeshId = `${geometryId}/${materialId}`
const bindingMap: {[instancedMeshId: string]: InstancedMeshBinding } = {};

export default class InstancedMeshGraphics extends GameObjectComponent
{
    // Swaps the texture of a shared TexturePack binding in place (e.g. when the voxel texture pack
    // changes), preserving the binding's mesh/material/shader and reusing it. A no-op if the binding
    // hasn't been created yet (e.g. before the first voxel has spawned).
    static async swapTexturePackTexture(geometryId: string, materialId: string, newTexturePath: string)
    {
        const instancedMeshId = InstancedMeshIdUtil.getInstancedMeshId(geometryId, materialId);
        const binding = bindingMap[instancedMeshId];
        if (!binding)
            return;
        await binding.swapTexturePackTexture(newTexturePath);
    }

    async loadInstancedMesh(geometryId: string, materialParams: MaterialParams,
        maxNumInstances: number, createInstanceIdPool: boolean)
    {
        const instancedMeshId = InstancedMeshIdUtil.getInstancedMeshId(geometryId, materialParams.getMaterialId());
        if (bindingMap[instancedMeshId])
            return;
        const binding = new InstancedMeshBinding(materialParams, geometryId,
            maxNumInstances, createInstanceIdPool);
        await binding.loadInstancedMesh();
        bindingMap[instancedMeshId] = binding;
    }

    reserveInstance(geometryId: string, materialId: string, instanceId: number)
    {
        const instancedMeshId = InstancedMeshIdUtil.getInstancedMeshId(geometryId, materialId);
        bindingMap[instancedMeshId].reserveInstance(this.gameObject, instanceId);
    }
    unreserveInstance(geometryId: string, materialId: string, instanceId: number)
    {
        const instancedMeshId = InstancedMeshIdUtil.getInstancedMeshId(geometryId, materialId);
        bindingMap[instancedMeshId].unreserveInstance(this.gameObject, instanceId);
    }

    rentInstanceFromPool(geometryId: string, materialId: string): number
    {
        const instancedMeshId = InstancedMeshIdUtil.getInstancedMeshId(geometryId, materialId);
        return bindingMap[instancedMeshId].rentInstanceFromPool(this.gameObject);
    }
    returnInstanceToPool(geometryId: string, materialId: string, instanceId: number)
    {
        const instancedMeshId = InstancedMeshIdUtil.getInstancedMeshId(geometryId, materialId);
        bindingMap[instancedMeshId].returnInstanceToPool(this.gameObject, instanceId);
    }

    updateInstanceTransform(geometryId: string, materialId: string, instanceId: number,
        offsetX: number, offsetY: number, offsetZ: number,
        dirX: number, dirY: number, dirZ: number,
        xScale: number = 1, yScale: number = 1, zScale: number = 1)
    {
        const instancedMeshId = InstancedMeshIdUtil.getInstancedMeshId(geometryId, materialId);
        bindingMap[instancedMeshId].updateInstanceTransform(
            this.gameObject, instanceId,
            offsetX, offsetY, offsetZ, dirX, dirY, dirZ, xScale, yScale, zScale);
    }

    updateInstanceTextureUV(geometryId: string, materialId: string, instanceId: number, textureIndex: number,
        sampleOffsetX: number = 0, sampleOffsetY: number = 0,
        sampleScaleX: number = 1, sampleScaleY: number = 1)
    {
        const instancedMeshId = InstancedMeshIdUtil.getInstancedMeshId(geometryId, materialId);
        bindingMap[instancedMeshId].updateInstanceTextureUV(
            this.gameObject, instanceId, textureIndex,
            sampleOffsetX, sampleOffsetY, sampleScaleX, sampleScaleY);
    }

    updateInstanceColor(geometryId: string, materialId: string, instanceId: number,
        r: number, g: number, b: number)
    {
        const instancedMeshId = InstancedMeshIdUtil.getInstancedMeshId(geometryId, materialId);
        bindingMap[instancedMeshId].updateInstanceColor(
            this.gameObject, instanceId, r, g, b);
    }

    updateInstanceEyeColors(geometryId: string, materialId: string, instanceId: number,
        r_pupil: number, g_pupil: number, b_pupil: number,
        r_iris: number, g_iris: number, b_iris: number)
    {
        const instancedMeshId = InstancedMeshIdUtil.getInstancedMeshId(geometryId, materialId);
        bindingMap[instancedMeshId].updateInstanceEyeColors(
            this.gameObject, instanceId, r_pupil, g_pupil, b_pupil, r_iris, g_iris, b_iris);
    }

    updateInstanceEyeRadii(geometryId: string, materialId: string, instanceId: number,
        pupilRadius: number, irisRadius: number)
    {
        const instancedMeshId = InstancedMeshIdUtil.getInstancedMeshId(geometryId, materialId);
        bindingMap[instancedMeshId].updateInstanceEyeRadii(
            this.gameObject, instanceId, pupilRadius, irisRadius);
    }

    async drawImageAtIndex(geometryId: string, materialId: string, textureIndex: number, imageURL: string)
    {
        const instancedMeshId = InstancedMeshIdUtil.getInstancedMeshId(geometryId, materialId);
        await bindingMap[instancedMeshId].drawImageAtIndex(textureIndex, imageURL);
    }
}