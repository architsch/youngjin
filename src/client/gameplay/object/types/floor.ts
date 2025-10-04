import GameObject from "./gameObject";
import Mesh from "../../../graphics/mesh";
import World from "../../world";
import ObjectTransform from "../../../../shared/types/gameplay/objectTransform";

export default class Floor extends GameObject
{
    constructor(world: World, sourceUserName: string, objectId: string, transform: ObjectTransform)
    {
        super(world, sourceUserName, objectId, transform);

        const mesh = Mesh.floor();
        this.obj.add(mesh);
        mesh.rotation.set(-Math.PI*0.5, 0, 0);
        mesh.position.set(0, 0, 0);
    }

    getObjectType(): string
    {
        return "Floor";
    }
}