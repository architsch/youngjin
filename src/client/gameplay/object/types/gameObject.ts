import * as THREE from "three";
import World from "../../world";

export default abstract class GameObject
{
    objectId: string;
    obj: THREE.Object3D;
    world: World;

    constructor(world: World, objectId: string, x: number, z: number, angleY: number)
    {
        this.objectId = objectId;
        this.obj = new THREE.Object3D();
        this.world = world;

        world.graphicsContext.scene.add(this.obj);
        this.obj.position.set(x, 0, z);
        this.obj.rotation.set(0, angleY, 0);
    }

    onSpawn(): void
    {
    }

    onDespawn()
    {
    }
    
    get position(): THREE.Vector3 { return this.obj.position; }
    set position(p: THREE.Vector3) { this.obj.position.set(p.x, p.y, p.z); }

    get rotation(): THREE.Euler { return this.obj.rotation; }
    set rotation(r: THREE.Euler) { this.obj.rotation.set(r.x, r.y, r.z); }

    get quaternion(): THREE.Quaternion { return this.obj.quaternion; }
    set quaternion(q: THREE.Quaternion) { this.obj.quaternion.set(q.x, q.y, q.z, q.w); }
}