import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import MeshFactory from "../../graphics/factories/meshFactory";
import GameObject from "../types/gameObject";
import InstancedMeshConfig from "../../graphics/types/instancedMeshConfig";
import { InstancedMeshConfigMap } from "../../graphics/maps/instancedMeshConfigMap";
import TextureUtil from "../../graphics/util/textureUtil";
import TexturePackMaterialParams from "../../graphics/types/material/texturePackMaterialParams";
import App from "../../app";
import MaterialParams from "../../graphics/types/material/materialParams";

const tempObj = new THREE.Object3D();
const vec3Temp = new THREE.Vector3();

const objMap: {[meshId: string] : { [instanceId: number]: GameObject }} = {};

export default class InstancedMeshGraphics extends GameObjectComponent
{
    instanceIds: number[] = [];
    materialParams: MaterialParams | undefined;
    instancedMesh: THREE.InstancedMesh | undefined;
    instancedMeshConfig: InstancedMeshConfig;

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

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);
        this.instancedMeshConfig = InstancedMeshConfigMap[this.componentConfig.instancedMeshConfigId];
    }

    getMeshId(): string
    {
        const materialParams = this.instancedMeshConfig.getMaterialParams(this.gameObject);
        const materialId = materialParams.getMaterialId();
        return `${this.instancedMeshConfig.geometryId}-${materialId}`;
    }

    async setInstanceTexture(instanceId: number, textureURL: string)
    {
        const indexInInstanceIdsArray = this.instanceIds.indexOf(instanceId);
        const meshInstanceParams = this.instancedMeshConfig.getMeshInstanceParams(this.gameObject, instanceId, indexInInstanceIdsArray);
        const textureIndex = meshInstanceParams.textureIndex;

        const materialParams = this.instancedMeshConfig.getMaterialParams(this.gameObject);
        const texturePackMaterialParams = materialParams as TexturePackMaterialParams;
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

    setTextureIndex(instanceId: number, textureIndex: number)
    {
        const texturePackMaterialParams = this.materialParams as TexturePackMaterialParams;
        const w = texturePackMaterialParams.textureWidth;
        const h = texturePackMaterialParams.textureHeight;
        const cw = texturePackMaterialParams.textureGridCellWidth;
        const ch = texturePackMaterialParams.textureGridCellHeight;

        const textureGridCellWidthScale = cw / w;
        const textureGridCellHeightScale = ch / h;

        const uvStartBufferAttrib = this.instancedMesh!.geometry.getAttribute("uvStart");

        // (0.5 / cw) = pixel-bleeding prevention shift
        const uStart = textureGridCellWidthScale * ((0.5 / cw) + textureIndex % (1 / textureGridCellWidthScale));

        // (0.5 / ch) = pixel-bleeding prevention shift
        const vStart = textureGridCellHeightScale * ((0.5 / ch) + Math.floor(textureIndex * textureGridCellWidthScale));
        
        uvStartBufferAttrib.setXY(instanceId, uStart, vStart);
        uvStartBufferAttrib.needsUpdate = true;
    }

    async onSpawn(): Promise<void>
    {
        this.materialParams = this.instancedMeshConfig.getMaterialParams(this.gameObject);

        const { instancedMesh, rentedInstanceIds } = await MeshFactory.loadInstancedMesh(
            this.instancedMeshConfig.geometryId,
            this.materialParams,
            this.instancedMeshConfig.totalNumInstances,
            this.instancedMeshConfig.getNumInstancesToRent(this.gameObject)
        );

        if (!instancedMesh.name)
            instancedMesh.name = this.getMeshId();
            
        this.instancedMesh = instancedMesh;

        let objByInstanceId = objMap[instancedMesh.name];
        if (objByInstanceId == undefined)
        {
            objByInstanceId = {};
            objMap[instancedMesh.name] = objByInstanceId;
        }

        for (const instanceId of rentedInstanceIds)
        {
            this.instanceIds.push(instanceId);
            if (objByInstanceId[instanceId] != undefined)
                console.error(`InstanceId already exists in objByInstanceId (instanceId = ${instanceId}, meshId = ${this.getMeshId()}, existingObjectId = ${objByInstanceId[instanceId].params.objectId}, newObjectId = ${this.gameObject.params.objectId})`);
            objByInstanceId[instanceId] = this.gameObject;
        }

        this.gameObject.obj.updateMatrixWorld();
        this.gameObject.obj.add(tempObj);

        for (let i = 0; i < rentedInstanceIds.length; ++i)
        {
            const instanceId = rentedInstanceIds[i];
            const params = this.instancedMeshConfig.getMeshInstanceParams(this.gameObject, instanceId, i);

            tempObj.position.set(0, 0, 0);
            
            vec3Temp.set(
                this.gameObject.position.x + params.dirX,
                this.gameObject.position.y + params.dirY,
                this.gameObject.position.z + params.dirZ
            );
            tempObj.lookAt(vec3Temp);
            tempObj.getWorldDirection(vec3Temp);

            tempObj.position.set(params.xOffset, params.yOffset, params.zOffset);
            tempObj.updateMatrixWorld();

            instancedMesh.setMatrixAt(instanceId, tempObj.matrixWorld);
            instancedMesh.instanceMatrix.needsUpdate = true;

            this.setTextureIndex(instanceId, params.textureIndex);

            // temp (for test)
            if (this.gameObject.params.objectTypeIndex == 2)
                this.setInstanceTexture(instanceId, `${App.getEnv().assets_url}/lenna.png`);
        }

        tempObj.removeFromParent();
    }

    async onDespawn(): Promise<void>
    {
        const meshId = this.instancedMesh!.name;
        MeshFactory.unload(meshId, this.instanceIds);

        let objByInstanceId = objMap[meshId];
        if (objByInstanceId == undefined)
        {
            console.error(`MeshId doesn't exist in objMap (meshId = ${meshId})`);
        }
        else
        {
            for (const instanceId of this.instanceIds)
                delete objByInstanceId[instanceId];
        }
    }
}