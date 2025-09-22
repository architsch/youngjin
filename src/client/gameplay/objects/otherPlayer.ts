import GraphicsContext from "../../graphics/graphicsContext";
import Mesh from "../../graphics/mesh";
import GameObject from "./gameObject";
import Updatable from "../interfaces/updatable";

export default class OtherPlayer extends GameObject implements Updatable
{
    constructor(graphicsContext: GraphicsContext, x: number, z: number)
    {
        super(graphicsContext, x, z);
        
        const mesh = Mesh.player();
        this.obj.add(mesh);
        mesh.position.set(0, 1.25, 0);
    }

    update(deltaTime: number): void
    {
    }
}