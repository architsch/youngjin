import * as THREE from "three";
import GraphicsManager from "../../graphics/graphicsManager";
import App from "../../app";
import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import GameObjectComponent from "../components/gameObjectComponent";
import ObjectComponentFactory from "../factories/objectComponentFactory";
import ObjectTypeConfig, { SpawnType } from "../../../shared/object/types/objectTypeConfig";

const vec3Temp = new THREE.Vector3();

export default abstract class GameObject
{
    params: ObjectSpawnParams;
    obj: THREE.Object3D = new THREE.Object3D();
    config: ObjectTypeConfig;
    components: {[componentName: string]: GameObjectComponent} = {};
    spawnFinished: boolean = false;

    constructor(params: ObjectSpawnParams)
    {
        this.params = params;

        GraphicsManager.addObjectToScene(this.obj);
        this.position.set(this.params.transform.x, this.params.transform.y, this.params.transform.z);
        vec3Temp.set(
            this.params.transform.x + this.params.transform.dirX,
            this.params.transform.y + this.params.transform.dirY,
            this.params.transform.z + this.params.transform.dirZ
        );
        this.obj.lookAt(vec3Temp);
        
        this.config = ObjectTypeConfigMap.getConfigByIndex(this.params.objectTypeIndex);
        for (const [spawnType, componentConfigs] of Object.entries(this.config.components))
        {
            if (this.meetsSpawnCondition(spawnType as SpawnType))
            {
                for (const [componentName, componentConfig] of Object.entries(componentConfigs))
                {
                    if (this.components[componentName] != undefined)
                        throw new Error(`Duplicate component found (objectId = ${params.objectId}, objectType = ${this.config.objectType}, componentName = ${componentName})`);
                    const component = ObjectComponentFactory.createComponent(this, componentName, componentConfig);
                    this.components[componentName] = component;
                }
            }
        }
    }

    // Customizable callback functions
    onClick(instanceId: number, hitPoint: THREE.Vector3) {}
    onPlayerProximityStart() {}
    onPlayerProximityEnd() {}

    async onSpawn(): Promise<void>
    {
        for (const component of Object.values(this.components))
        {
            if (component.onSpawn)
                await component.onSpawn();
        }
        this.spawnFinished = true;
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
        return this.params.sourceUserID == App.getUser().id;
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