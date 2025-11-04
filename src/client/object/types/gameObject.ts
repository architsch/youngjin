import * as THREE from "three";
import GraphicsManager from "../../graphics/graphicsManager";
import App from "../../app";
import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import GameObjectComponent from "../components/gameObjectComponent";
import ObjectComponentFactory from "../factories/objectComponentFactory";
import { SpawnType } from "../../../shared/object/types/objectTypeConfig";

export default class GameObject
{
    params: ObjectSpawnParams;
    obj: THREE.Object3D = new THREE.Object3D();
    components: {[componentName: string]: GameObjectComponent} = {};

    constructor(params: ObjectSpawnParams)
    {
        this.params = params;

        GraphicsManager.addObjectToScene(this.obj);
        this.obj.position.set(this.params.transform.x, this.params.transform.y, this.params.transform.z);
        this.obj.rotation.set(this.params.transform.eulerX, this.params.transform.eulerY, this.params.transform.eulerZ);
        
        const config = ObjectTypeConfigMap.getConfigByIndex(this.params.objectTypeIndex);
        for (const [spawnType, objectComponentGroupConfig] of Object.entries(config.components))
        {
            if (this.meetsSpawnCondition(spawnType as SpawnType))
            {
                for (const [componentName, componentConfig] of Object.entries(objectComponentGroupConfig))
                {
                    if (this.components[componentName] != undefined)
                        throw new Error(`Duplicate component found (objectId = ${params.objectId}, objectType = ${config.objectType}, componentName = ${componentName})`);
                    const component = ObjectComponentFactory.createComponent(this, componentName, componentConfig);
                    this.components[componentName] = component;
                }
            }
        }
    }

    async onSpawn(): Promise<void>
    {
        for (const component of Object.values(this.components))
        {
            if (component.onSpawn)
                await component.onSpawn();
        }
    }

    async onDespawn(): Promise<void>
    {
        this.obj.removeFromParent();

        for (const component of Object.values(this.components))
        {
            if (component.onDespawn)
                await component.onDespawn();
        }
    }

    isMine(): boolean
    {
        return this.params.sourceUserName == App.getEnv().user.userName;
    }

    trySetPosition(position: THREE.Vector3)
    {
        let overrideFound = false;
        for (const component of Object.values(this.components))
        {
            if (component.trySetPosition)
            {
                if (overrideFound)
                    throw new Error("Multiple components with the 'trySetPosition' method detected. This is not allowed.");
                overrideFound = true;
                component.trySetPosition(position);
            }
        }
        if (!overrideFound)
            this.position.copy(position);
    }

    forceSetPosition(position: THREE.Vector3)
    {
        let overrideFound = false;
        for (const component of Object.values(this.components))
        {
            if (component.forceSetPosition)
            {
                if (overrideFound)
                    throw new Error("Multiple components with the 'forceSetPosition' method detected. This is not allowed.");
                overrideFound = true;
                component.forceSetPosition(position);
            }
        }
        if (!overrideFound)
            this.position.copy(position);
    }
    
    get position(): THREE.Vector3 { return this.obj.position; }
    set position(p: THREE.Vector3) { this.obj.position.set(p.x, p.y, p.z); }

    get rotation(): THREE.Euler { return this.obj.rotation; }
    set rotation(r: THREE.Euler) { this.obj.rotation.set(r.x, r.y, r.z); }

    get quaternion(): THREE.Quaternion { return this.obj.quaternion; }
    set quaternion(q: THREE.Quaternion) { this.obj.quaternion.set(q.x, q.y, q.z, q.w); }

    protected meetsSpawnCondition(spawnType: SpawnType): boolean
    {
        return spawnType == "spawnedByAny" ||
            (spawnType == "spawnedByMe" && this.isMine()) ||
            (spawnType == "spawnedByOther" && !this.isMine());
    }
}