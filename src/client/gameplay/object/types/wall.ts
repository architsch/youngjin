import GameObject from "./gameObject";
import Mesh from "../../../graphics/mesh";
import World from "../../world";
import ObjectTransform from "../../../../shared/types/gameplay/objectTransform";

export default class Wall extends GameObject
{
    constructor(world: World, sourceUserName: string, objectId: string, transform: ObjectTransform)
    {
        super(world, sourceUserName, objectId, transform);

        const mesh = Mesh.wall();
        this.obj.add(mesh);
        mesh.position.set(0, 2, 0);
    }

    getObjectType(): string
    {
        return "Wall";
    }
}