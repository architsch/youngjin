import GameObject from "./gameObject";
import Mesh from "../../../graphics/mesh";
import World from "../../world";
import ObjectTransform from "../../../../shared/types/networking/objectTransform";

export default class Floor extends GameObject
{
    constructor(world: World, objectId: string, transform: ObjectTransform)
    {
        super(world, objectId, transform);

        const mesh = Mesh.floor();
        this.obj.add(mesh);
        mesh.rotation.set(-Math.PI*0.5, 0, 0);
        mesh.position.set(0, 0, 0);
    }
}