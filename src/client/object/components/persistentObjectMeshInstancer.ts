import GameObjectComponent from "./gameObjectComponent";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import GameObject from "../types/gameObject";
import PersistentObject from "../../../shared/object/types/persistentObject";
import TexturePackMaterialParams from "../../graphics/types/material/texturePackMaterialParams";

export default class PersistentObjectMeshInstancer extends GameObjectComponent
{
    instancedMeshGraphics: InstancedMeshGraphics;

    private instanceId: number = -1;
    private persistentObject: PersistentObject | undefined;

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);

        this.instancedMeshGraphics = this.gameObject.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("PersistentObjectMeshInstancer requires InstancedMeshGraphics component");

        const materialParams = new TexturePackMaterialParams("persistent_object_texture_pack",
            2048, 2048, 256, 256, "dynamicEmpty");
        this.instancedMeshGraphics.setInstancingProperties(materialParams,
            "Square", 8192);
    }

    async onSpawn(): Promise<void>
    {        
        if (this.persistentObject == undefined)
            throw new Error(`PersistentObject hasn't been defined yet.`);

        await this.instancedMeshGraphics.loadInstancedMesh();
        this.instanceId = this.instancedMeshGraphics.rentInstanceFromPool();

        this.instancedMeshGraphics.updateInstanceTransform(this.instanceId, 0, 0, 0.01, 0, 0, 1);
        this.instancedMeshGraphics.updateInstanceTextureUV(this.instanceId, this.instanceId % 64);
    }

    async onDespawn(): Promise<void>
    {        
        if (this.persistentObject == undefined)
            throw new Error(`PersistentObject hasn't been defined yet.`);

        this.instancedMeshGraphics.returnInstanceToPool(this.instanceId);
    }

    getPersistentObject(): PersistentObject
    {
        if (!this.persistentObject)
            throw new Error(`PersistentObject has not been assigned (params = ${JSON.stringify(this.gameObject.params)})`);
        return this.persistentObject;
    }

    setPersistentObject(persistentObject: PersistentObject): void
    {
        this.persistentObject = persistentObject;
    }
}