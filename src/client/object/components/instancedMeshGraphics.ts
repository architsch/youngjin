import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import MeshFactory from "../../graphics/factories/meshFactory";
import GraphicsManager from "../../graphics/graphicsManager";
import GameObject from "../types/gameObject";
import InstancedMeshConfig from "../../graphics/types/instancedMeshConfig";
import { InstancedMeshConfigMap } from "../../graphics/maps/instancedMeshConfigMap";

const pixelBleedingPreventionShift = 0.5 / 128;
const textureGridCellScale = 0.125;
const tempObj = new THREE.Object3D();
const vec3Temp = new THREE.Vector3();

const objByInstanceId: { [instanceId: number]: GameObject } = {};

export default class InstancedMeshGraphics extends GameObjectComponent
{
    instanceIds: number[] = [];

    static findGameObject(instanceId: number): GameObject | undefined
    {
        return objByInstanceId[instanceId];
    }

    getMeshId(): string
    {
        const config = this.getInstancedMeshConfig();
        const materialParams = config.getMaterialParams(this.gameObject);
        const materialId = `${materialParams.type}-${materialParams.additionalParam}`;
        return `${config.geometryId}-${materialId}`;
    }

    getInstancedMeshConfig(): InstancedMeshConfig
    {
        const id = this.componentConfig.instancedMeshConfigId;
        return InstancedMeshConfigMap[id];
    }

    async onSpawn(): Promise<void>
    {
        const config = this.getInstancedMeshConfig();
        const { instancedMesh, rentedInstanceIds } = await MeshFactory.loadInstancedMesh(
            config.geometryId,
            config.getMaterialParams(this.gameObject),
            config.totalNumInstances,
            config.getNumInstancesToRent(this.gameObject)
        );
        for (const instanceId of rentedInstanceIds)
        {
            this.instanceIds.push(instanceId);
            if (objByInstanceId[instanceId] != undefined)
                console.error(`InstanceId already exists in objByInstanceId (instanceId = ${instanceId})`);
            objByInstanceId[instanceId] = this.gameObject;
        }

        // Assign meshId to the mesh object's name.
        if (!instancedMesh.name)
            instancedMesh.name = this.getMeshId();
        instancedMesh.frustumCulled = false;

        GraphicsManager.addObjectToSceneIfNotAlreadyAdded(instancedMesh);

        this.gameObject.obj.updateMatrixWorld();
        this.gameObject.obj.add(tempObj);

        for (let i = 0; i < rentedInstanceIds.length; ++i)
        {
            const instanceId = rentedInstanceIds[i];
            const params = config.getMeshInstanceParams(this.gameObject, i);

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

            instancedMesh.geometry.attributes.uvStart.setXY(
                instanceId,
                textureGridCellScale *
                    (pixelBleedingPreventionShift + params.textureIndex % 8),
                textureGridCellScale *
                    (pixelBleedingPreventionShift + Math.floor(params.textureIndex * 0.125))
            );
            instancedMesh.geometry.attributes.uvStart.needsUpdate = true;
        }

        tempObj.removeFromParent();
    }

    async onDespawn(): Promise<void>
    {
        MeshFactory.unload(this.getMeshId(), this.instanceIds);

        for (const instanceId of this.instanceIds)
            delete objByInstanceId[instanceId];
    }
}