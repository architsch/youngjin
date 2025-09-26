import GameObject from "./gameObject";
import Mesh from "../../../graphics/mesh";
import World from "../../world";

export default class Floor extends GameObject
{
    constructor(world: World, objectId: string, x: number, z: number, angleY: number)
    {
        super(world, objectId, x, z, angleY);

        const mesh = Mesh.floor();
        this.obj.add(mesh);
        mesh.rotation.set(-Math.PI*0.5, 0, 0);
        mesh.position.set(0, 0, 0);
    }
}