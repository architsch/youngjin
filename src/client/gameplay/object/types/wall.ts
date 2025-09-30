import GameObject from "./gameObject";
import Mesh from "../../../graphics/mesh";
import World from "../../world";
import ObjectTransform from "../../../../shared/types/networking/objectTransform";

export default class Wall extends GameObject
{
    constructor(world: World, objectId: string, transform: ObjectTransform)
    {
        super(world, objectId, transform);

        const mesh = Mesh.wall();
        this.obj.add(mesh);
        mesh.position.set(0, 2, 0);
    }
}