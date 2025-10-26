import * as THREE from "three";
import MeshFactory from "../../graphics/factories/meshFactory";
import GraphicsManager from "../../graphics/graphicsManager";
import GameObject from "./gameObject";
import MaterialParams from "../../graphics/types/materialParams";

const pixelBleedingPreventionShift = 0.5 / 128;
const textureGridCellScale = 0.125;
const tempObj = new THREE.Object3D();
const xAxis = new THREE.Vector3(1, 0, 0);
const yAxis = new THREE.Vector3(0, 1, 0);

export default abstract class InstancedMeshObject extends GameObject
{
    protected instanceIds: number[] = [];

    getMeshId(): string
    {
        const materialParams = this.params.metadata.materialParams;
        const materialId = `${materialParams.type}-${materialParams.additionalParam}`;
        return `${this.params.metadata.geometryId}-${materialId}`;
    }

    abstract getNumInstancesToRent(): number;
    abstract getMeshInstanceInfo(indexInInstanceIdsArray: number)
        : { xOffset: number, yOffset: number, zOffset: number,
            xAxisAngle: number, yAxisAngle: number, textureIndex: number };

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();

        const { instancedMesh, rentedInstanceIds } = await MeshFactory.loadInstancedMesh(
            this.params.metadata.geometryId as string,
            this.params.metadata.materialParams as MaterialParams,
            this.params.metadata.totalNumInstances as number,
            this.getNumInstancesToRent()
        );
        for (const instanceId of rentedInstanceIds)
            this.instanceIds.push(instanceId);

        // Assign meshId to the mesh object's name.
        if (!instancedMesh.name)
            instancedMesh.name = this.getMeshId();
        instancedMesh.frustumCulled = false;

        GraphicsManager.addObjectToSceneIfNotAlreadyAdded(instancedMesh);

        this.obj.updateMatrixWorld();
        this.obj.add(tempObj);

        for (let i = 0; i < rentedInstanceIds.length; ++i)
        {
            const instanceId = rentedInstanceIds[i];
            const info = this.getMeshInstanceInfo(i);

            tempObj.position.set(0, 0, 0);
            tempObj.rotation.set(0, 0, 0);
            tempObj.rotateOnAxis(yAxis, info.yAxisAngle);
            tempObj.rotateOnAxis(xAxis, info.xAxisAngle);
            tempObj.position.set(info.xOffset, info.yOffset, info.zOffset);
            tempObj.updateMatrixWorld();

            instancedMesh.setMatrixAt(instanceId, tempObj.matrixWorld);
            instancedMesh.instanceMatrix.needsUpdate = true;

            instancedMesh.geometry.attributes.uvStart.setXY(
                instanceId,
                textureGridCellScale *
                    (pixelBleedingPreventionShift + info.textureIndex % 8),
                textureGridCellScale *
                    (pixelBleedingPreventionShift + Math.floor(info.textureIndex * 0.125))
            );
            instancedMesh.geometry.attributes.uvStart.needsUpdate = true;
        }

        tempObj.removeFromParent();
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();

        MeshFactory.unload(this.getMeshId(), this.instanceIds);
    }
}