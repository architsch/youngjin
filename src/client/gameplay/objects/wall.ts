import GameObject from "./gameObject";
import GraphicsContext from "../../graphics/graphicsContext";
import Mesh from "../../graphics/mesh";

export default class Wall extends GameObject
{
    constructor(graphicsContext: GraphicsContext, x: number, z: number)
    {
        super(graphicsContext, x, z);

        const mesh = Mesh.wall();
        this.obj.add(mesh);
        mesh.position.set(0, 2, 0);
    }
}