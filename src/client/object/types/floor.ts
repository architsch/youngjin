import GameObject from "./gameObject";
import MeshFactory from "../../graphics/factories/meshFactory";
import ObjectSpawnParams from "../../../shared/types/object/objectSpawnParams";

export default class Floor extends GameObject
{
    constructor(params: ObjectSpawnParams)
    {
        super(params);

        MeshFactory.load("Floor", params.metadata.textureId).then(mesh => {
            const meshClone = mesh.clone();
            this.obj.add(meshClone);
        });
    }
}