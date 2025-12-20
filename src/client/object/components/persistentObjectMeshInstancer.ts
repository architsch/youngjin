import GameObjectComponent from "./gameObjectComponent";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import GameObject from "../types/gameObject";
import PersistentObject from "../../../shared/object/types/persistentObject";

export default class PersistentObjectMeshInstancer extends GameObjectComponent
{
    instancedMeshGraphics: InstancedMeshGraphics;

    private persistentObject: PersistentObject | undefined;

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);

        this.instancedMeshGraphics = this.gameObject.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("PersistentObjectMeshInstancer requires InstancedMeshGraphics component");
    }

    async onSpawn(): Promise<void>
    {        
        if (this.persistentObject == undefined)
            throw new Error(`PersistentObject hasn't been defined yet.`);

        const instanceId = await this.instancedMeshGraphics.loadInstance();

        this.instancedMeshGraphics.updateInstanceTransform(instanceId, 0, 0, 0.01, 0, 0, 1);
        this.instancedMeshGraphics.updateInstanceTextureIndex(instanceId, instanceId % 64);
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