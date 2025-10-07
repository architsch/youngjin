import GameObject from "./gameObject";
import MeshFactory from "../../graphics/factories/meshFactory";
import ObjectSpawnParams from "../../../shared/types/object/objectSpawnParams";

export default class Wall extends GameObject
{
    constructor(params: ObjectSpawnParams)
    {
        super(params);

        MeshFactory.load("Wall", params.metadata.textureId).then(mesh => {
            const meshClone = mesh.clone();
            this.obj.add(meshClone);
        });
    }
}