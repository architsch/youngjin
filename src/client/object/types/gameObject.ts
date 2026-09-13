import * as THREE from "three";
import GraphicsManager from "../../graphics/graphicsManager";
import App from "../../app";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import GameObjectComponent from "../components/gameObjectComponent";
import ObjectComponentFactory from "../factories/objectComponentFactory";
import ObjectTypeConfig, { SpawnType } from "../../../shared/object/types/objectTypeConfig/objectTypeConfig";
import { ObjectMetadataKey } from "../../../shared/object/types/objectMetadataKey";
import Vec3 from "../../../shared/math/types/vec3";
import ObjectTypeClientConfigMap from "../maps/objectTypeClientConfigMap";
import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import GameModeUtil from "../../system/util/gameModeUtil";

const vec3Temp = new THREE.Vector3();
const cameraPosTemp = new THREE.Vector3();

// A new GameObject type needs: a GameObject subclass, an ObjectTypeConfigMap entry (what it is), and
// an ObjectTypeClientConfigMap entry (how it's built and selected).
export default abstract class GameObject
{
    params: AddObjectSignal; // When a GameObject spawns, use these parameters to initialize it.
    obj: THREE.Object3D = new THREE.Object3D(); // The GameObject's authoritative gameplay transform (position/rotation/scale). Networking (transform emitter/receiver), physics, camera, and proximity logic all read and write this.
    visualObj: THREE.Object3D = new THREE.Object3D(); // A child of "obj" that carries only the visual representation (meshes). Cosmetic effects (e.g. EasingMotion's bounce) animate this node so they never disturb the gameplay transform on "obj". It rests at identity; per-mesh local transforms live on the meshes themselves.
    config: ObjectTypeConfig;
    components: {[componentName: string]: GameObjectComponent} = {};
    spawnFinished: boolean = false;

    constructor(params: AddObjectSignal)
    {
        this.params = params;

        GraphicsManager.addObjectToScene(this.obj);
        this.obj.add(this.visualObj);
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

    onClick(instanceId: number, _hitPoint: THREE.Vector3)
    {
        this.trySelect(instanceId);
    }

    // Selects what the given instance shows (the object itself, unless overridden); false if refused.
    trySelect(_instanceId: number): boolean
    {
        return this.canBeSelected() && ObjectSelection.trySelect(this);
    }

    canBeSelected(): boolean
    {
        if (!GameModeUtil.isInEditMode())
            return false;

        const selectionConfig = ObjectTypeClientConfigMap.getConfigByIndex(
            this.params.objectTypeIndex).selection;
        if (!selectionConfig) // Not picked out as an object at all (see VoxelGameObject).
            return false;

        const room = App.getCurrentRoom();
        if (room == undefined)
            return false;

        return selectionConfig.canBeSelectedByUserInEditMode(this, App.getUser(), room);
    }

    // Optional callbacks for subclasses:
    onPlayerProximityStart() {} // Invoked when the object gets close to the player.
    onPlayerProximityEnd() {} // Invoked when the object moves away from the player.
    onSetMetadata(key: ObjectMetadataKey, value: string) // Invoked when the object's metadata is set (e.g. one of the entries in object's "metadata" field).
    {
        for (const component of Object.values(this.components))
        {
            if (component.onSetMetadata)
                component.onSetMetadata(key, value);
        }
    }
    // Called after a cosmetic effect moves visualObj. Baked renderers (instanced meshes) override this
    // to re-apply instance transforms.
    onVisualTransformChanged() {}
    // Per-frame update for objects that override this or have a component with update().
    update(deltaTime: number) {}

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

    // Aliases
    get position(): THREE.Vector3 { return this.obj.position; }
    get direction(): THREE.Vector3
    {
        const direction = new THREE.Vector3();
        this.obj.getWorldDirection(direction);
        return direction;
    }
    setObjectTransform(pos: Vec3, dir: Vec3)
    {
        this.obj.position.set(pos.x, pos.y, pos.z);
        const target = new THREE.Vector3(
            this.position.x + dir.x,
            this.position.y + dir.y,
            this.position.z + dir.z
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