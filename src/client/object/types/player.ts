import FirstPersonController from "../components/firstPersonController";
import NetworkObject from "./networkObject";
import SpeechBubble from "../components/speechBubble";
import ObjectMessageParams from "../../../shared/types/object/objectMessageParams";
import ObjectSpawnParams from "../../../shared/types/object/objectSpawnParams";
import ModelFactory from "../../graphics/factories/modelFactory";
import App from "../../app"

export default class Player extends NetworkObject
{
    private firstPersonController: FirstPersonController | undefined;
    private speechBubble: SpeechBubble | undefined;

    constructor(params: ObjectSpawnParams)
    {
        super(params);

        if (this.isMine())
        {
            this.firstPersonController = new FirstPersonController(this);
        }
        else
        {
            this.speechBubble = new SpeechBubble(this, 3);

            ModelFactory.load(`${App.getEnv().assets_url}/lowpolyghost/lowpolyghost.glb`).then(model => {
                const modelClone = model.clone();
                this.obj.add(modelClone);
                modelClone.position.set(0, 0.13, 0);
                modelClone.scale.set(0.7, 0.7, 0.7);
                modelClone.rotation.set(0, Math.PI, 0);
            });
        }
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