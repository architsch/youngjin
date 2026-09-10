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
import WorldSpaceSelectionUtil from "../../graphics/util/worldSpaceSelectionUtil";
import GameModeUtil from "../../system/util/gameModeUtil";

const vec3Temp = new THREE.Vector3();
const cameraPosTemp = new THREE.Vector3();

// Whenever you are implementing a new GameObject type, you must:
//      (1) Create a class for the new type and make sure that it inherits from GameObject.
//      (2) Add an entry to ObjectTypeConfigMap, describing what the new type *is*.
//      (3) Add an entry to ObjectTypeClientConfigMap, describing how one is built and what picking
//          one out brings out on screen.
// Whenever you are modifying an existing GameObject type, you must:
//      (1) Make appropriate modifications to the existing type's class (i.e. the one which inherits from GameObject).
//      (2) Make appropriate modifications to the existing type's entries in the two maps above.
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

    // Invoked when the object is clicked by the user's pointer input (mouse or touch). "instanceId"
    // is the ID of the mesh instance that was hit by the user's pointer input (-1 if the mesh is not
    // instanced).
    //
    // A click on an object is how the user takes hold of it, and every kind of object is taken hold
    // of in exactly the same way — what differs between one kind and the next is only whether *this*
    // user may take hold of *this* one, which each kind answers for itself (see
    // ObjectTypeClientConfig). So the taking is done here rather than by each kind in turn.
    //
    // Two kinds of object override this. One that is not picked out as an object at all answers the
    // click its own way (see VoxelGameObject), and one that a click means something else besides
    // does its own thing alongside the taking (see DoorGameObject).
    onClick(_instanceId: number, hitPoint: THREE.Vector3)
    {
        this.trySelectByClick(hitPoint);
    }

    // Whether this user may take hold of this object as things currently stand.
    //
    // Only one condition is asked of every object there is: the user has to be in **edit mode**,
    // since taking hold of a thing is the beginning of changing it and changing things is what that
    // mode is — outside it a click on the room is a click on the room and nothing more. Who may take
    // hold of what is otherwise the kind of object's own single rule, whole and in one place (see
    // ObjectTypeClientConfig), which is also where a refusal the user ought to hear about is
    // explained to him.
    //
    // Asked here without making the click, and without the reach a click has to have, because an
    // object for which a click means something else besides has to know which of its two meanings
    // applies before it acts on either (see DoorGameObject).
    canBeSelectedNow(): boolean
    {
        const selectionConfig = ObjectTypeClientConfigMap.getConfigByIndex(
            this.params.objectTypeIndex).selection;
        if (!selectionConfig) // Not picked out as an object at all (see VoxelGameObject).
            return false;

        if (!GameModeUtil.isInEditMode())
            return false;

        const room = App.getCurrentRoom();
        if (room == undefined)
            return false;

        return selectionConfig.canBeSelectedByUser(this, App.getUser(), room);
    }

    // Takes hold of this object on the user's behalf, if the click that landed on it is one that may
    // take hold of it at all. Reports whether it did.
    protected trySelectByClick(hitPoint: THREE.Vector3): boolean
    {
        // Out of the user's reach, which is read as a click on nothing at all: he cannot take hold
        // of something across the room that he can barely make out (see WorldSpaceSelectionUtil).
        // Asked first, so that a click which was never going to land is not answered with an
        // explanation of why it was refused.
        GraphicsManager.getCamera().getWorldPosition(cameraPosTemp);
        if (hitPoint.distanceTo(cameraPosTemp) > WorldSpaceSelectionUtil.getMaxSelectDist())
            return false;

        if (!this.canBeSelectedNow())
            return false;

        return ObjectSelection.trySelect(this);
    }

    // Callback functions which must be overriden by subclasses
    // if they are meant to be used:
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
    // Invoked after a cosmetic effect (e.g. EasingMotion) transforms this GameObject's "visualObj".
    // Scene-graph meshes follow "visualObj" automatically and need nothing here; baked renderers such
    // as instanced meshes don't, so those GameObjects override this to re-apply their instance
    // transforms (recomputed from their own source of truth, which composes the moved "visualObj").
    onVisualTransformChanged() {}
    // Invoked once per frame for GameObjects registered as updatable — i.e. those that override this,
    // or that carry at least one component with its own "update" method. Override to drive per-frame
    // logic such as character-part animation. Default is a no-op.
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