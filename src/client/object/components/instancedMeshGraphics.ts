import GameObjectComponent from "./gameObjectComponent";
import MaterialParams from "../../../shared/graphics/material/types/materialParams";
import InstancedMeshBinding from "../../graphics/types/mesh/instancedMeshBinding";
import MeshDataUtil from "../../../shared/graphics/mesh/util/meshDataUtil";

// instancedMeshId = MeshDataUtil.getInstancedMeshId(geometryId, materialId)
const bindingMap: {[instancedMeshId: string]: InstancedMeshBinding } = {};

// The instancedMeshId is the canonical key of every loaded instanced mesh: loadInstancedMesh derives
// it once from the geometry/material pair, and all per-instance methods take it directly (rather
// than re-deriving it per call), so the per-frame paths do no string building at all.
export default class InstancedMeshGraphics extends GameObjectComponent
{
    // Swaps the texture of a shared TexturePack binding in place (e.g. when the voxel texture pack
    // changes), preserving the binding's mesh/material/shader and reusing it. A no-op if the binding
    // hasn't been created yet (e.g. before the first voxel has spawned).
    static async swapTexturePackTexture(instancedMeshId: string, newTexturePath: string)
    {
        const binding = bindingMap[instancedMeshId];
        if (!binding)
            return;
        await binding.swapTexturePackTexture(newTexturePath);
    }

    async loadInstancedMesh(geometryId: string, materialParams: MaterialParams,
        maxNumInstances: number, createInstanceIdPool: boolean)
    {
        const instancedMeshId = MeshDataUtil.getInstancedMeshId(geometryId, materialParams.getMaterialId());
        if (bindingMap[instancedMeshId])
            return;
        const binding = new InstancedMeshBinding(materialParams, geometryId,
            maxNumInstances, createInstanceIdPool);
        await binding.loadInstancedMesh();
        bindingMap[instancedMeshId] = binding;
    }

    instancedMeshIsLoaded(instancedMeshId: string): boolean
    {
        return bindingMap[instancedMeshId] != undefined;
    }

    reserveInstance(instancedMeshId: string, instanceId: number)
    {
        bindingMap[instancedMeshId].reserveInstance(this.gameObject, instanceId);
    }
    unreserveInstance(instancedMeshId: string, instanceId: number)
    {
        bindingMap[instancedMeshId].unreserveInstance(this.gameObject, instanceId);
    }

    rentInstanceFromPool(instancedMeshId: string): number
    {
        return bindingMap[instancedMeshId].rentInstanceFromPool(this.gameObject);
    }
    returnInstanceToPool(instancedMeshId: string, instanceId: number)
    {
        bindingMap[instancedMeshId].returnInstanceToPool(this.gameObject, instanceId);
    }

    updateInstanceTransform(instancedMeshId: string, instanceId: number,
        offsetX: number, offsetY: number, offsetZ: number,
        dirX: number, dirY: number, dirZ: number,
        xScale: number = 1, yScale: number = 1, zScale: number = 1)
    {
        bindingMap[instancedMeshId].updateInstanceTransform(
            this.gameObject, instanceId,
            offsetX, offsetY, offsetZ, dirX, dirY, dirZ, xScale, yScale, zScale);
    }

    updateInstanceTextureUV(instancedMeshId: string, instanceId: number, textureIndex: number,
        sampleOffsetX: number = 0, sampleOffsetY: number = 0,
        sampleScaleX: number = 1, sampleScaleY: number = 1)
    {
        bindingMap[instancedMeshId].updateInstanceTextureUV(
            this.gameObject, instanceId, textureIndex,
            sampleOffsetX, sampleOffsetY, sampleScaleX, sampleScaleY);
    }

    updateInstanceColor(instancedMeshId: string, instanceId: number,
        r: number, g: number, b: number)
    {
        bindingMap[instancedMeshId].updateInstanceColor(
            this.gameObject, instanceId, r, g, b);
    }

    updateInstanceEyeColors(instancedMeshId: string, instanceId: number,
        r_pupil: number, g_pupil: number, b_pupil: number,
        r_iris: number, g_iris: number, b_iris: number)
    {
        bindingMap[instancedMeshId].updateInstanceEyeColors(
            this.gameObject, instanceId, r_pupil, g_pupil, b_pupil, r_iris, g_iris, b_iris);
    }

    updateInstanceEyeRadii(instancedMeshId: string, instanceId: number,
        pupilRadius: number, irisRadius: number)
    {
        bindingMap[instancedMeshId].updateInstanceEyeRadii(
            this.gameObject, instanceId, pupilRadius, irisRadius);
    }

    // The optional source UV rect restricts sampling to a sub-region of the source image
    // (e.g. a single cell of an atlas image); by default the full image is drawn.
    async drawImageAtIndex(instancedMeshId: string,
        textureIndex: number, imageURL: string,
        widthScale: number = 1, heightScale: number = 1,
        sourceU1: number = 0, sourceV1: number = 0,
        sourceU2: number = 1, sourceV2: number = 1,
        unloadTextureAfterDraw: boolean = true)
    {
        await bindingMap[instancedMeshId].drawImageAtIndex(textureIndex, imageURL,
            widthScale, heightScale, sourceU1, sourceV1, sourceU2, sourceV2,
            unloadTextureAfterDraw);
    }
}
