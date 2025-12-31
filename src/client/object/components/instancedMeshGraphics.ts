import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import MeshFactory from "../../graphics/factories/meshFactory";
import GameObject from "../types/gameObject";
import TextureUtil from "../../graphics/util/textureUtil";
import TexturePackMaterialParams from "../../graphics/types/material/texturePackMaterialParams";
import App from "../../app";
import MaterialParams from "../../graphics/types/material/materialParams";

const tempObj = new THREE.Object3D();
const vec3Temp = new THREE.Vector3();

const objMap: {[meshId: string] : { [instanceId: number]: GameObject }} = {};

export default class InstancedMeshGraphics extends GameObjectComponent
{
    materialParams: MaterialParams | undefined; // must be set by an instancer component
    geometryId: string = ""; // must be set by an instancer component
    maxNumInstances: number = 0; // must be set by an instancer component
    instancedMesh: THREE.InstancedMesh | undefined;

    static findGameObject(instancedMeshObj: THREE.Object3D, instanceId: number): GameObject | undefined
    {
        const objByInstanceId = objMap[instancedMeshObj.name];
        if (objByInstanceId == undefined)
        {
            console.error(`MeshId doesn't exist in objMap (meshId = ${instancedMeshObj.name})`);
            return undefined;
        }
        return objByInstanceId[instanceId];
    }

    setInstancingProperties(materialParams: MaterialParams, geometryId: string, maxNumInstances: number)
    {
        this.materialParams = materialParams;
        this.geometryId = geometryId;
        this.maxNumInstances = maxNumInstances;
    }

    getMeshId(): string
    {
        if (this.instancedMesh) // If instancedMesh is already loaded, just grab the meshId from its name.
            return this.instancedMesh.name;

        if (!this.materialParams)
            throw new Error("MaterialParams hasn't been set yet.");
        const materialId = this.materialParams.getMaterialId();
        return `${this.geometryId}-${materialId}`;
    }

    async loadInstancedMesh(): Promise<void>
    {
        if (this.instancedMesh) // instancedMesh is already loaded
            return;
        if (!this.materialParams)
            throw new Error("MaterialParams hasn't been set yet.");

        const instancedMesh = await MeshFactory.loadInstancedMesh(
            this.geometryId,
            this.materialParams,
            this.maxNumInstances,
            this.componentConfig.createInstanceIdPool
        );
        if (!instancedMesh.name)
            instancedMesh.name = this.getMeshId();
        this.instancedMesh = instancedMesh;

        if (objMap[instancedMesh.name] == undefined)
            objMap[instancedMesh.name] = {};
    }

    reserveInstance(instanceId: number)
    {
        if (!this.instancedMesh)
            throw new Error("InstancedMesh hasn't been loaded yet.");

        const objByInstanceId = objMap[this.getMeshId()];
        if (objByInstanceId[instanceId] != undefined)
            console.error(`instanceId already exists in objByInstanceId (instanceId = ${instanceId}, meshId = ${this.getMeshId()}, existingObjectId = ${objByInstanceId[instanceId].params.objectId}, objectId = ${this.gameObject.params.objectId})`);
        objByInstanceId[instanceId] = this.gameObject;
    }

    // Returns the rented instance's instanceId
    rentInstanceFromPool(): number
    {
        if (!this.instancedMesh)
            throw new Error("InstancedMesh hasn't been loaded yet.");
        if (!this.componentConfig.createInstanceIdPool)
            throw new Error("You cannot rent an instance without an instanceId pool.");

        const instanceId = MeshFactory.rentInstanceId(this.getMeshId());
        this.reserveInstance(instanceId);
        return instanceId;
    }

    unreserveInstance(instanceId: number)
    {
        if (!this.instancedMesh)
            throw new Error("InstancedMesh hasn't been loaded yet.");

        const objByInstanceId = objMap[this.getMeshId()];
        if (objByInstanceId[instanceId] == undefined)
            console.error(`instanceId doesn't exist in objByInstanceId (instanceId = ${instanceId}, meshId = ${this.getMeshId()}, objectId = ${this.gameObject.params.objectId})`);
        delete objByInstanceId[instanceId];

        this.updateInstanceTransform(instanceId, 0, -9999, 0, 0, -1, 0);
    }

    returnInstanceToPool(instanceId: number)
    {
        if (!this.instancedMesh)
            throw new Error("InstancedMesh hasn't been loaded yet.");
        if (!this.componentConfig.createInstanceIdPool)
            throw new Error("You cannot return an instance without an instanceId pool.");

        MeshFactory.returnInstanceId(this.getMeshId(), instanceId);
        this.unreserveInstance(instanceId);
    }

    updateInstanceTransform(instanceId: number,
        offsetX: number, offsetY: number, offsetZ: number,
        dirX: number, dirY: number, dirZ: number,
        xScale: number = 1, yScale: number = 1, zScale: number = 1)
    {
        if (!this.instancedMesh)
        {
            console.error(`InstancedMesh hasn't been loaded yet (objectId = ${this.gameObject.params.objectId})`);
            return;
        }
        this.gameObject.obj.updateMatrixWorld();
        this.gameObject.obj.add(tempObj);

        tempObj.scale.set(xScale, yScale, zScale);

        tempObj.position.set(0, 0, 0);
        vec3Temp.set(
            this.gameObject.position.x + dirX,
            this.gameObject.position.y + dirY,
            this.gameObject.position.z + dirZ
        );
        tempObj.lookAt(vec3Temp);
        tempObj.getWorldDirection(vec3Temp);

        tempObj.position.set(offsetX, offsetY, offsetZ);
        tempObj.updateMatrixWorld();

        this.instancedMesh.setMatrixAt(instanceId, tempObj.matrixWorld);
        this.instancedMesh.instanceMatrix.needsUpdate = true;

        tempObj.removeFromParent();
    }

    // Sample offsets and scales are normalized numbers in range [0,1], corresponding to the full range of pixels covered by the texture's sampling window.
    updateInstanceTextureUV(instanceId: number, textureIndex: number,
        sampleOffsetX: number = 0, sampleOffsetY: number = 0,
        sampleScaleX: number = 1, sampleScaleY: number = 1)
    {
        if (!this.instancedMesh)
        {
            console.error(`InstancedMesh hasn't been loaded yet (objectId = ${this.gameObject.params.objectId})`);
            return;
        }
        const texturePackMaterialParams = this.materialParams as TexturePackMaterialParams;
        const w = texturePackMaterialParams.textureWidth;
        const h = texturePackMaterialParams.textureHeight;
        const cw = texturePackMaterialParams.textureGridCellWidth;
        const ch = texturePackMaterialParams.textureGridCellHeight;

        const textureGridCellWidthScale = cw / w;
        const textureGridCellHeightScale = ch / h;

        const uvStartBufferAttrib = this.instancedMesh.geometry.getAttribute("uvStart");
        // (0.5 / cw) = pixel-bleeding prevention shift
        const uStart = textureGridCellWidthScale
            * ((0.5 / cw) + textureIndex % (1 / textureGridCellWidthScale) + sampleOffsetX);
        // (0.5 / ch) = pixel-bleeding prevention shift
        const vStart = textureGridCellHeightScale
            * ((0.5 / ch) + Math.floor(textureIndex * textureGridCellWidthScale) + sampleOffsetY);
        uvStartBufferAttrib.setXY(instanceId, uStart, vStart);
        uvStartBufferAttrib.needsUpdate = true;

        const uvSampleSizeBufferAttrib = this.instancedMesh.geometry.getAttribute("uvSampleSize");
        uvSampleSizeBufferAttrib.setXY(instanceId, sampleScaleX, sampleScaleY);
        uvSampleSizeBufferAttrib.needsUpdate = true;

        // temp (for test)
        if (this.gameObject.params.objectTypeIndex == 2)
            this.drawTextureAtIndex(instanceId % 64, `${App.getEnv().assets_url}/lenna.png`);
    }

    async drawTextureAtIndex(textureIndex: number, textureURL: string)
    {
        const texturePackMaterialParams = this.materialParams as TexturePackMaterialParams;
        const w = texturePackMaterialParams.textureWidth;
        const h = texturePackMaterialParams.textureHeight;
        const cw = texturePackMaterialParams.textureGridCellWidth;
        const ch = texturePackMaterialParams.textureGridCellHeight;

        const textureGridCellWidthScale = cw / w;
        const textureGridCellHeightScale = ch / h;
        
        const textureRow = Math.floor(textureIndex * textureGridCellWidthScale);
        const textureCol = textureIndex % (1 / textureGridCellWidthScale);
        const u1 = textureGridCellWidthScale * textureCol;
        const u2 = u1 + textureGridCellWidthScale;
        const v1 = textureGridCellHeightScale * textureRow;
        const v2 = v1 + textureGridCellHeightScale;

        const material = this.instancedMesh!.material as THREE.MeshPhongMaterial;
        const rt = material.map!.renderTarget as THREE.WebGLRenderTarget;
        await TextureUtil.drawTextureOnRenderTarget(textureURL, rt, u1, v1, u2, v2);
    }
}