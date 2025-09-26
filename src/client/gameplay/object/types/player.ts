import Mesh from "../../../graphics/mesh";
import World from "../../world";
import FirstPersonController from "../../component/firstPersonController";
import NetworkObject from "./networkObject";

export default class Player extends NetworkObject
{
    private firstPersonController: FirstPersonController | undefined;

    constructor(world: World, objectId: string, x: number, z: number, angleY: number, mine: boolean)
    {
        super(world, objectId, x, z, angleY, mine);

        if (this.isMine())
        {
            this.firstPersonController = new FirstPersonController(this);
        }
        else
        {
            const mesh = Mesh.player();
            this.obj.add(mesh);
            mesh.position.set(0, 1.25, 0);
        }
    }

    update(deltaTime: number): void
    {
        super.update(deltaTime);
        
        this.firstPersonController?.update(deltaTime);
    }
} 