import GameObjectComponent from "./gameObjectComponent";
import MaterialParams from "../../../shared/graphics/material/types/materialParams";
import InstancedMeshBinding from "../../graphics/types/mesh/instancedMeshBinding";
import MeshDataUtil from "../../../shared/graphics/mesh/util/meshDataUtil";

// instancedMeshId = MeshDataUtil.getInstancedMeshId(geometryId, materialId)
const bindingMap: {[instancedMeshId: string]: InstancedMeshBinding } = {};

// Per-instance methods take the precomputed instancedMeshId, so per-frame paths build no strings.
export default class InstancedMeshGraphics extends GameObjectComponent
{
    // Swaps a texture pack binding's texture in place. No-op before the binding exists.
    static async swapTexturePackTexture(instancedMeshId: string, newTexturePath: string)
    {
        const binding = bindingMap[instancedMeshId];
        if (!binding)
            return;
        await binding.swapTexturePackTexture(newTexturePath);
    }

    // Hides/reveals one instance without disturbing its owner (see InstancedMeshBinding.setInstanceHidden).
    // Addressed by mesh, since callers find instances via raycasts. No-op before the binding exists.
    static setInstanceHidden(instancedMeshId: string, instanceId: number, hidden: boolean)
    {
        bindingMap[instancedMeshId]?.setInstanceHidden(instanceId, hidden);
    }

    // False if the binding doesn't exist yet.
    static instanceIsHidden(instancedMeshId: string, instanceId: number): boolean
    {
        return bindingMap[instancedMeshId]?.instanceIsHidden(instanceId) === true;
    }

    // Addressed by mesh because room-wide sweeps set it (see RestrictedZoneOutlineUtil). No-op before
    // the binding exists.
    static setInstanceOutline(instancedMeshId: string, instanceId: number, strength: number)
    {
        bindingMap[instancedMeshId]?.updateInstanceOutline(instanceId, strength);
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

    // Undefined when the pool is exhausted (see MeshFactory.rentInstanceId).
    rentInstanceFromPool(instancedMeshId: string): number | undefined
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

    updateInstanceMouldingParams(instancedMeshId: string, instanceId: number,
        r: number, g: number, b: number,
        thickness: number, convex: boolean)
    {
        bindingMap[instancedMeshId].updateInstanceMouldingParams(
            this.gameObject, instanceId, r, g, b, thickness, convex);
    }

    // The optional source UV rect selects a sub-region (e.g. one atlas cell).
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

    // Draws a caller-drawn canvas over the whole cell.
    drawCanvasAtIndex(instancedMeshId: string, textureIndex: number, canvas: HTMLCanvasElement)
    {
        bindingMap[instancedMeshId].drawCanvasAtIndex(textureIndex, canvas);
    }
}
