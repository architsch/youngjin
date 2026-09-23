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
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import ObjectTypeClientConfigMap from "../maps/objectTypeClientConfigMap";
import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import GameModeUtil from "../../system/util/gameModeUtil";

const vec3Temp = new THREE.Vector3();
const cameraPosTemp = new THREE.Vector3();
const rightTemp = new THREE.Vector3();
const upTemp = new THREE.Vector3();
const normalTemp = new THREE.Vector3();
const basisTemp = new THREE.Matrix4();

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

        this.config = ObjectTypeConfigMap.getConfigByIndex(this.params.objectTypeIndex);

        GraphicsManager.addObjectToScene(this.obj);
        this.obj.add(this.visualObj);
        this.applyTransform(this.params.transform.pos, this.params.transform.dir);

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
    // Visits instances the object renders itself, outside its components (e.g. a canvas's picture), so
    // whole-object actions reach them (see OrbitOcclusionHider).
    forEachOwnedInstance(_visit: (instancedMeshId: string, instanceId: number) => void) {}
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
        this.applyTransform(pos, dir);
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

    // Not setObjectTransform, which subclasses extend with state the constructor hasn't set up yet.
    private applyTransform(pos: Vec3, dir: Vec3)
    {
        this.obj.position.set(pos.x, pos.y, pos.z);
        if (this.config.attachment)
        {
            // From the face's own axes. lookAt would leave a floor or ceiling facing's roll to the error
            // its stored facing decodes with (see Geometry3DUtil.getAxisFacingBasis).
            const {normal, right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
            basisTemp.makeBasis(rightTemp.set(right.x, right.y, right.z), upTemp.set(up.x, up.y, up.z),
                normalTemp.set(normal.x, normal.y, normal.z));
            this.obj.quaternion.setFromRotationMatrix(basisTemp);
            return;
        }
        vec3Temp.set(pos.x + dir.x, pos.y + dir.y, pos.z + dir.z);
        this.obj.lookAt(vec3Temp);
    }
}