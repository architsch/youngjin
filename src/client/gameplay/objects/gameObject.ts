import * as THREE from "three";
import GraphicsContext from "../../graphics/graphicsContext";

export default abstract class GameObject
{
    id: number;

    protected obj: THREE.Object3D;
    protected graphicsContext: GraphicsContext;

    constructor(graphicsContext: GraphicsContext, x: number, z: number)
    {
        this.id = 0;
        this.obj = new THREE.Object3D();
        this.graphicsContext = graphicsContext;

        graphicsContext.scene.add(this.obj);
        this.obj.position.set(x, 0, z);
    }
    
    get position(): THREE.Vector3 { return this.obj.position; }
    set position(p: THREE.Vector3) { this.obj.position.set(p.x, p.y, p.z); }
}