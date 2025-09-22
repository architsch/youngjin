import GameObject from "./gameObject";
import GraphicsContext from "../../graphics/graphicsContext";
import Mesh from "../../graphics/mesh";

export default class Floor extends GameObject
{
    constructor(graphicsContext: GraphicsContext, x: number, z: number)
    {
        super(graphicsContext, x, z);

        const mesh = Mesh.floor();
        this.obj.add(mesh);
        mesh.rotation.set(-Math.PI*0.5, 0, 0);
        mesh.position.set(0, 0, 0);
    }
}