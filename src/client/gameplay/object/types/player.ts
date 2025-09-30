import * as THREE from "three";
import Mesh from "../../../graphics/mesh";
import World from "../../world";
import FirstPersonController from "../../component/firstPersonController";
import NetworkObject from "./networkObject";
import ObjectTransform from "../../../../shared/types/networking/objectTransform";

export default class Player extends NetworkObject
{
    private firstPersonController: FirstPersonController | undefined;

    constructor(world: World, objectId: string, transform: ObjectTransform, mine: boolean)
    {
        super(world, objectId, transform, mine);

        if (this.isMine())
        {
            this.firstPersonController = new FirstPersonController(this);
        }
        else
        {
            let mesh: THREE.Mesh = Mesh.player();
            this.obj.add(mesh);
            mesh.position.set(0, 1.1, 0);

            mesh = Mesh.playerEye();
            this.obj.add(mesh);
            mesh.position.set(-0.1, 2, -0.235);

            mesh = Mesh.playerEye();
            this.obj.add(mesh);
            mesh.position.set(0.1, 2, -0.235);
        }
    }

    update(deltaTime: number): void
    {
        super.update(deltaTime);
        
        this.firstPersonController?.update(deltaTime);
    }
} 