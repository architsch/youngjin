import ObjectSpawnParams from "../../../shared/types/object/objectSpawnParams";
import MeshFactory from "../../graphics/factories/meshFactory";
import GraphicsManager from "../../graphics/graphicsManager";
import GameObject from "./gameObject";

export default abstract class InstancedMeshObject extends GameObject
{
    private instanceId: number;

    constructor(params: ObjectSpawnParams)
    {
        super(params);

        this.instanceId = -1;
    }

    getMeshId(): string
    {
        return `${this.params.metadata.geometryId}-${this.params.metadata.materialId}`;
    }
    getMeshInstanceId(): string
    {
        return `${this.params.metadata.geometryId}-${this.params.metadata.materialId}-${this.instanceId}`;
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
        instancedMesh.frustumCulled = false;
        //instancedMesh.castShadow = true;
        //instancedMesh.receiveShadow = true;
        this.instanceId = instanceId;
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();

        MeshFactory.unload(this.getMeshId(), this.instanceId);
    }
}