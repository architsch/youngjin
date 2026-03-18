import * as THREE from "three";
import GraphicsManager from "../../graphics/graphicsManager";
import App from "../../app";
import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import GameObjectComponent from "../components/gameObjectComponent";
import ObjectComponentFactory from "../factories/objectComponentFactory";
import ObjectTypeConfig, { SpawnType } from "../../../shared/object/types/objectTypeConfig";
import { ObjectMetadataKey } from "../../../shared/object/types/objectMetadataKey";

const vec3Temp = new THREE.Vector3();

// Whenever you are implementing a new GameObject type, you must:
//      (1) Create a class for the new type and make sure that it inherits from GameObject.
//      (2) Add an entry to ObjectConstructorMap.
//      (3) Add an entry to ObjectTypeConfigMap.
// Whenever you are modifying an existing GameObject type, you must:
//      (1) Make appropriate modifications to the existing type's class (i.e. the one which inherits from GameObject).
//      (2) Make appropriate modifications to the existing type's entry in ObjectTypeConfigMap.
export default abstract class GameObject
{
    params: ObjectSpawnParams; // When a GameObject spawns, use these parameters to initialize it.
    obj: THREE.Object3D = new THREE.Object3D(); // This Three.js object holds the GameObject's transform attributes such as position, rotation, and scale.
    config: ObjectTypeConfig;
    components: {[componentName: string]: GameObjectComponent} = {};
    spawnFinished: boolean = false;

    constructor(params: ObjectSpawnParams)
    {
        this.params = params;

        GraphicsManager.addObjectToScene(this.obj);
        this.position.set(this.params.transform.pos.x, this.params.transform.pos.y, this.params.transform.pos.z);
        vec3Temp.set(
            this.params.transform.pos.x + this.params.transform.dir.x,
            this.params.transform.pos.y + this.params.transform.dir.y,
            this.params.transform.pos.z + this.params.transform.dir.z
        );
        this.obj.lookAt(vec3Temp);

        this.config = ObjectTypeConfigMap.getConfigByIndex(this.params.objectTypeIndex);
        for (const [spawnType, componentConfigs] of Object.entries(this.config.components))
        {
            // Only add components which meet the object's spawn condition.
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

    // Callback functions which must be overriden by subclasses
    // if they are meant to be used:
    onClick(instanceId: number, hitPoint: THREE.Vector3) {} // Invoked when the object is clicked by the user's pointer input (mouse or touch). "instanceId" is the ID of the mesh instance that was hit by the user's pointer input.
    onPlayerProximityStart() {} // Invoked when the object gets close to the player.
    onPlayerProximityEnd() {} // Invoked when the object moves away from the player.
    onSetMetadata(key: ObjectMetadataKey, value: string) {} // Invoked when the object's metadata is set (e.g. one of the entries in PersistentObject's "metadata" field).

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

    // Checks to see if the transform-updating process should be regulated by one of the components
    // (e.g. collider updating the object's transform based on physics).
    // If there is one, let that component intercept the transform-updating process.
    // If not, just assign the given position/direction to the object's current transform.
    trySetTransform(position: THREE.Vector3, direction: THREE.Vector3)
    {
        let overrideFound = false;
        for (const component of Object.values(this.components))
        {
            if (component.trySetTransform)
            {
                if (overrideFound)
                    throw new Error("Multiple components with the 'trySetTransform' method detected. This is not allowed.");
                overrideFound = true;
                component.trySetTransform(position, direction);
            }
        }
        if (!overrideFound)
        {
            this.position.copy(position);
            this.direction = direction;
        }
    }

    // This method works like "trySetTransform", but is intended to be invoked
    // only in cases where the object's position/direction must be set forcefully rather than
    // based on real-time physical collision.
    // (e.g. when the object's client-side position is out of sync with its server-side position,
    //      or when an object with a static collider needs to be relocated).
    forceSetTransform(position: THREE.Vector3, direction: THREE.Vector3)
    {
        let overrideFound = false;
        for (const component of Object.values(this.components))
        {
            if (component.forceSetTransform)
            {
                if (overrideFound)
                    throw new Error("Multiple components with the 'forceSetTransform' method detected. This is not allowed.");
                overrideFound = true;
                component.forceSetTransform(position, direction);
            }
        }
        if (!overrideFound)
        {
            this.position = position;
            this.direction = direction;
        }
    }

    // Aliases
    get position(): THREE.Vector3 { return this.obj.position; }
    set position(p: THREE.Vector3) { this.obj.position.set(p.x, p.y, p.z); }
    get direction(): THREE.Vector3
    {
        const direction = new THREE.Vector3();
        this.obj.getWorldDirection(direction);
        return direction;
    }
    set direction(d: THREE.Vector3)
    {
        const target = new THREE.Vector3(
            this.position.x + d.x,
            this.position.y + d.y,
            this.position.z + d.z
        );
        this.obj.lookAt(target);
    }
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