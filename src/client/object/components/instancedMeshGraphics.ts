import GameObjectComponent from "./gameObjectComponent";
import MaterialParams from "../../graphics/types/material/materialParams";
import InstancedMeshBinding from "../../graphics/types/mesh/instancedMeshBinding";

// bindingKey = `${objectTypeIndex}/${bodyPartName}`
const bindingMap: {[bindingKey: string]: InstancedMeshBinding } = {};

export default class InstancedMeshGraphics extends GameObjectComponent
{
    // Swaps the texture of a shared TexturePack binding in place (e.g. when the voxel texture pack
    // changes), preserving the binding's mesh/material/shader and reusing it. A no-op if the binding
    // hasn't been created yet (e.g. before the first voxel has spawned).
    static async swapTexturePackTexture(objectTypeIndex: number, bodyPartName: string, newTexturePath: string)
    {
        const binding = bindingMap[InstancedMeshGraphics.getBindingKey(objectTypeIndex, bodyPartName)];
        if (!binding)
            return;
        await binding.swapTexturePackTexture(newTexturePath);
    }

    async loadInstancedMesh(bodyPartName: string, materialParams: MaterialParams,
        geometryId: string, maxNumInstances: number, createInstanceIdPool: boolean)
    {
        const bindingKey = this.getBindingKey(bodyPartName);
        if (bindingMap[bindingKey])
            return;
        const binding = new InstancedMeshBinding(materialParams, geometryId,
            maxNumInstances, createInstanceIdPool);
        await binding.loadInstancedMesh();
        bindingMap[bindingKey] = binding;
    }

    reserveInstance(bodyPartName: string, instanceId: number)
    {
        bindingMap[this.getBindingKey(bodyPartName)].reserveInstance(this.gameObject, instanceId);
    }
    unreserveInstance(bodyPartName: string, instanceId: number)
    {
        bindingMap[this.getBindingKey(bodyPartName)].unreserveInstance(this.gameObject, instanceId);
    }

    rentInstanceFromPool(bodyPartName: string): number
    {
        return bindingMap[this.getBindingKey(bodyPartName)].rentInstanceFromPool(this.gameObject);
    }
    returnInstanceToPool(bodyPartName: string, instanceId: number)
    {
        bindingMap[this.getBindingKey(bodyPartName)].returnInstanceToPool(this.gameObject, instanceId);
    }

    updateInstanceTransform(bodyPartName: string, instanceId: number,
        offsetX: number, offsetY: number, offsetZ: number,
        dirX: number, dirY: number, dirZ: number,
        xScale: number = 1, yScale: number = 1, zScale: number = 1)
    {
        bindingMap[this.getBindingKey(bodyPartName)].updateInstanceTransform(
            this.gameObject, instanceId,
            offsetX, offsetY, offsetZ, dirX, dirY, dirZ, xScale, yScale, zScale);
    }

    updateInstanceTextureUV(bodyPartName: string, instanceId: number, textureIndex: number,
        sampleOffsetX: number = 0, sampleOffsetY: number = 0,
        sampleScaleX: number = 1, sampleScaleY: number = 1)
    {
        bindingMap[this.getBindingKey(bodyPartName)].updateInstanceTextureUV(
            this.gameObject, instanceId, textureIndex,
            sampleOffsetX, sampleOffsetY, sampleScaleX, sampleScaleY);
    }

    updateInstanceColor(bodyPartName: string, instanceId: number, colorHex: number)
    {
        bindingMap[this.getBindingKey(bodyPartName)].updateInstanceColor(
            this.gameObject, instanceId, colorHex);
    }

    async drawImageAtIndex(bodyPartName: string, textureIndex: number, imageURL: string)
    {
        await bindingMap[this.getBindingKey(bodyPartName)].drawImageAtIndex(textureIndex, imageURL);
    }

    private getBindingKey(bodyPartName: string)
    {
        return InstancedMeshGraphics.getBindingKey(this.gameObject.params.objectTypeIndex, bodyPartName);
    }

    private static getBindingKey(objectTypeIndex: number, bodyPartName: string)
    {
        return `${objectTypeIndex}/${bodyPartName}`;
    }
}