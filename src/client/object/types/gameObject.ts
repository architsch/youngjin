import * as THREE from "three";
import GraphicsManager from "../../graphics/graphicsManager";
import App from "../../app";
import ObjectSpawnParams from "../../../shared/object/objectSpawnParams";
import Collider from "../components/collider";

export default abstract class GameObject
{
    params: ObjectSpawnParams;
    obj: THREE.Object3D = new THREE.Object3D();
    collider: Collider | undefined;

    constructor(params: ObjectSpawnParams)
    {
        this.params = params;
    }

    async onSpawn(): Promise<void>
    {
        GraphicsManager.addObjectToScene(this.obj);
        this.obj.position.set(this.params.transform.x, this.params.transform.y, this.params.transform.z);
        this.obj.rotation.set(this.params.transform.eulerX, this.params.transform.eulerY, this.params.transform.eulerZ);
    }

    async onDespawn(): Promise<void>
    {
        this.obj.removeFromParent();
        this.collider?.onDespawn();
    }

    isMine(): boolean
    {
        return this.params.sourceUserName == App.getEnv().user.userName;
    }

    trySetPosition(position: THREE.Vector3)
    {
        if (this.collider != undefined)
            this.collider.trySetPosition(position);
        else
            this.position.copy(position);
    }

    forceSetPosition(position: THREE.Vector3)
    {
        if (this.collider != undefined)
            this.collider.forceSetPosition(position);
        else
            this.position.copy(position);
    }

    addCollider()
    {
        if (this.collider != undefined)
            throw new Error(`Collider is already added (sourceUserName = ${this.params.sourceUserName}, objectId = ${this.params.objectId})`);
        this.collider = new Collider(this);
    }

    removeCollider()
    {
        if (this.collider == undefined)
            throw new Error(`Collider doesn't exist (sourceUserName = ${this.params.sourceUserName}, objectId = ${this.params.objectId})`);
        this.collider = undefined;
    }
    
    get position(): THREE.Vector3 { return this.obj.position; }
    set position(p: THREE.Vector3) { this.obj.position.set(p.x, p.y, p.z); }

    get rotation(): THREE.Euler { return this.obj.rotation; }
    set rotation(r: THREE.Euler) { this.obj.rotation.set(r.x, r.y, r.z); }

    get quaternion(): THREE.Quaternion { return this.obj.quaternion; }
    set quaternion(q: THREE.Quaternion) { this.obj.quaternion.set(q.x, q.y, q.z, q.w); }
}