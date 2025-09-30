import * as THREE from "three";
import World from "../../world";
import ObjectTransform from "../../../../shared/types/networking/objectTransform";

export default abstract class GameObject
{
    objectId: string;
    obj: THREE.Object3D;
    world: World;

    constructor(world: World, objectId: string, transform: ObjectTransform)
    {
        this.objectId = objectId;
        this.obj = new THREE.Object3D();
        this.world = world;
        
        this.obj.position.set(transform.x, transform.y, transform.z);
        this.obj.rotation.set(transform.eulerX, transform.eulerY, transform.eulerZ);
    }

    onSpawn(): void
    {
        this.world.graphicsContext.scene.add(this.obj);
    }

    onDespawn(): void
    {
        this.obj.removeFromParent();
    }
    
    get position(): THREE.Vector3 { return this.obj.position; }
    set position(p: THREE.Vector3) { this.obj.position.set(p.x, p.y, p.z); }

    get rotation(): THREE.Euler { return this.obj.rotation; }
    set rotation(r: THREE.Euler) { this.obj.rotation.set(r.x, r.y, r.z); }

    get quaternion(): THREE.Quaternion { return this.obj.quaternion; }
    set quaternion(q: THREE.Quaternion) { this.obj.quaternion.set(q.x, q.y, q.z, q.w); }
}