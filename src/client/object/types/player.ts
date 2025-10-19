import * as THREE from "three";
import FirstPersonController from "../components/firstPersonController";
import NetworkObject from "./networkObject";
import SpeechBubble from "../components/speechBubble";
import ModelFactory from "../../graphics/factories/modelFactory";
import App from "../../app";
import ObjectMessageParams from "../../../shared/object/objectMessageParams";

export default class Player extends NetworkObject
{
    private firstPersonController: FirstPersonController | undefined;
    private speechBubble: SpeechBubble | undefined;
    private model: THREE.Group | undefined;

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();

        if (this.isMine())
        {
            this.firstPersonController = new FirstPersonController(this);
        }
        else
        {
            this.speechBubble = new SpeechBubble(this, 3);

            const model = await ModelFactory.load(`${App.getEnv().assets_url}/lowpolyghost/lowpolyghost.glb`);
            this.model = model.clone();
            this.obj.add(this.model);
            this.model.position.set(0, 0.13, 0);
            this.model.scale.set(0.7, 0.7, 0.7);
            this.model.rotation.set(0, Math.PI, 0);
        }

        this.addCollider();
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();

        this.speechBubble?.onDespawn();
        this.model?.removeFromParent();
    }

    update(deltaTime: number): void
    {
        super.update(deltaTime);
        
        this.firstPersonController?.update(deltaTime);
        this.speechBubble?.update();
    }

    onObjectMessageReceived(params: ObjectMessageParams)
    {
        if (this.isMine())
        {
            console.error(`User's own object shouldn't be able to receive a message (receiverObjectID = ${this.params.sourceUserName}, senderObjectID = ${params.senderObjectId})`);
            return;
        }
        if (!params.senderObjectId.startsWith(this.params.sourceUserName))
        {
            console.error(`senderObjectId doesn't start with the object's sourceUserName. This is inconsistent with how objectId is being formatted. (receiverObjectID = ${this.params.sourceUserName}, senderObjectID = ${params.senderObjectId})`);
            return;
        }
        this.speechBubble?.showMessage(params.message);
    }
}