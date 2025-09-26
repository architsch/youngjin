import GameObject from "./gameObject";
import Mesh from "../../../graphics/mesh";
import World from "../../world";

export default class Wall extends GameObject
{
    constructor(world: World, objectId: string, x: number, z: number, angleY: number)
    {
        super(world, objectId, x, z, angleY);

        const mesh = Mesh.wall();
        this.obj.add(mesh);
        mesh.position.set(0, 2, 0);
    }
}