import * as THREE from "three";
import Mesh from "../../../graphics/mesh";
import World from "../../world";
import FirstPersonController from "../../component/firstPersonController";
import NetworkObject from "./networkObject";
import ObjectTransform from "../../../../shared/types/gameplay/objectTransform";
import SpeechBubble from "../../component/speechBubble";
import ObjectMessageParams from "../../../../shared/types/gameplay/objectMessageParams";

export default class Player extends NetworkObject
{
    private firstPersonController: FirstPersonController | undefined;
    private speechBubble: SpeechBubble | undefined;

    constructor(world: World, sourceUserName: string, objectId: string, transform: ObjectTransform)
    {
        super(world, sourceUserName, objectId, transform);

        if (this.isMine())
        {
            this.firstPersonController = new FirstPersonController(this);
        }
        else
        {
            this.speechBubble = new SpeechBubble(this, 2.4);

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

    getObjectType(): string
    {
        return "Player";
    }

    update(deltaTime: number): void
    {
        super.update(deltaTime);
        
        this.firstPersonController?.update(deltaTime);
        this.speechBubble?.update();
    }

    onDespawn(): void
    {
        super.onDespawn();

        this.speechBubble?.onDespawn();
    }

    onObjectMessageReceived(params: ObjectMessageParams)
    {
        if (this.isMine())
        {
            console.error(`User's own object shouldn't be able to receive a message (receiverObjectID = ${this.sourceUserName}, senderObjectID = ${params.senderObjectId})`);
            return;
        }
        if (!params.senderObjectId.startsWith(this.sourceUserName))
        {
            console.error(`senderObjectId doesn't start with the object's sourceUserName. This is inconsistent with how objectId is being formatted. (receiverObjectID = ${this.sourceUserName}, senderObjectID = ${params.senderObjectId})`);
            return;
        }
        this.speechBubble?.showMessage(params.message);
    }
}