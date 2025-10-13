import MeshFactory from "../../graphics/factories/meshFactory";
import GraphicsManager from "../../graphics/graphicsManager";
import GameObject from "./gameObject";

export default abstract class InstancedMeshObject extends GameObject
{
    private instanceId: number = -1;

    getMeshId(): string
    {
        return `${this.params.metadata.geometryId}-${this.params.metadata.materialId}`;
    }
    getMeshInstanceId(): string
    {
        return `${this.getMeshId()}-${this.instanceId}`;
    }

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();

        const { instancedMesh, instanceId } = await MeshFactory.loadInstancedMesh(
            this.params.metadata.geometryId as string,
            this.params.metadata.materialId as string,
            this.params.metadata.numInstances as number,
        );

        // Assign meshId to the mesh object's name.
        if (!instancedMesh.name)
            instancedMesh.name = this.getMeshId();

        GraphicsManager.addObjectToSceneIfNotAlreadyAdded(instancedMesh);

        this.obj.updateMatrix();
        instancedMesh.setMatrixAt(instanceId, this.obj.matrix);
        instancedMesh.instanceMatrix.needsUpdate = true;

        const uvStart = this.params.metadata.uvStart as [number, number];
        instancedMesh.geometry.attributes.uvStart.setXY(instanceId, uvStart[0], uvStart[1]);
        instancedMesh.geometry.attributes.uvStart.needsUpdate = true;

        instancedMesh.frustumCulled = false;

        this.instanceId = instanceId;
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();

        MeshFactory.unload(this.getMeshId(), this.instanceId);
    }
}