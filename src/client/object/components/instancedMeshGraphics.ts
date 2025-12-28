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
    instanceIds: number[] = [];
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

    async onDespawn(): Promise<void>
    {
        const meshId = this.instancedMesh!.name;
        MeshFactory.unload(meshId, this.instanceIds);

        let objByInstanceId = objMap[meshId];
        if (objByInstanceId == undefined)
            console.error(`MeshId doesn't exist in objMap (meshId = ${meshId})`);
        else
        {
            for (const instanceId of this.instanceIds)
                delete objByInstanceId[instanceId];
        }
        this.instanceIds.length = 0;
    }

    getMeshId(): string
    {
        if (!this.materialParams)
            throw new Error("MaterialParams hasn't been set yet.");
        const materialId = this.materialParams.getMaterialId();
        return `${this.geometryId}-${materialId}`;
    }

    async loadInstance(): Promise<number> // Returns the loaded instance's instanceId
    {
        if (!this.materialParams)
            throw new Error("MaterialParams hasn't been set yet.");
        const { instancedMesh, instanceId } = await MeshFactory.loadMeshInstance(
            this.geometryId,
            this.materialParams,
            this.maxNumInstances
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

        this.instanceIds.push(instanceId);
        if (objByInstanceId[instanceId] != undefined)
            console.error(`rentedInstanceId already exists in objByInstanceId (rentedInstanceId = ${instanceId}, meshId = ${this.getMeshId()}, existingObjectId = ${objByInstanceId[instanceId].params.objectId}, newObjectId = ${this.gameObject.params.objectId})`);
        objByInstanceId[instanceId] = this.gameObject;
        return instanceId;
    }

    updateInstanceTransform(instanceId: number,
        xOffset: number, yOffset: number, zOffset: number,
        dirX: number, dirY: number, dirZ: number)
    {
        if (!this.instancedMesh)
        {
            console.error(`InstancedMesh hasn't been loaded yet (objectId = ${this.gameObject.params.objectId})`);
            return;
        }
        this.gameObject.obj.updateMatrixWorld();
        this.gameObject.obj.add(tempObj);

        tempObj.position.set(0, 0, 0);
        vec3Temp.set(
            this.gameObject.position.x + dirX,
            this.gameObject.position.y + dirY,
            this.gameObject.position.z + dirZ
        );
        tempObj.lookAt(vec3Temp);
        tempObj.getWorldDirection(vec3Temp);

        tempObj.position.set(xOffset, yOffset, zOffset);
        tempObj.updateMatrixWorld();

        this.instancedMesh.setMatrixAt(instanceId, tempObj.matrixWorld);
        this.instancedMesh.instanceMatrix.needsUpdate = true;

        tempObj.removeFromParent();
    }

    updateInstanceTextureIndex(instanceId: number, textureIndex: number)
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
        const uStart = textureGridCellWidthScale * ((0.5 / cw) + textureIndex % (1 / textureGridCellWidthScale));

        // (0.5 / ch) = pixel-bleeding prevention shift
        const vStart = textureGridCellHeightScale * ((0.5 / ch) + Math.floor(textureIndex * textureGridCellWidthScale));
        
        uvStartBufferAttrib.setXY(instanceId, uStart, vStart);
        uvStartBufferAttrib.needsUpdate = true;

        // temp (for test)
        if (this.gameObject.params.objectTypeIndex == 2)
            this.drawTextureAtIndex(instanceId % 64, `${App.getEnv().assets_url}/lenna.png`);
    }

    unloadInstance(instanceId: number)
    {
        const meshId = this.instancedMesh!.name;
        MeshFactory.unload(meshId, [instanceId]);
        this.updateInstanceTransform(instanceId, 0, -9999, 0, 0, -1, 0);

        let objByInstanceId = objMap[meshId];
        if (objByInstanceId == undefined)
            console.error(`MeshId doesn't exist in objMap (meshId = ${meshId})`);
        else
            delete objByInstanceId[instanceId];

        const index = this.instanceIds.indexOf(instanceId);
        if (index < 0)
            console.error(`InstanceId not found in instanceIds array (instanceId = ${instanceId}, this.instanceIds = ${JSON.stringify(this.instanceIds)})`)
        else
        {
            for (let i = index + 1; i < this.instanceIds.length; ++i)
                this.instanceIds[i-1] = this.instanceIds[i];
            this.instanceIds.length--;
        }
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