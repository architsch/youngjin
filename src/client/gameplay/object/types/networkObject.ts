import ObjectSyncParams from "../../../../shared/types/gameplay/objectSyncParams";
import ObjectTransform from "../../../../shared/types/gameplay/objectTransform";
import GameSocketsClient from "../../../networking/gameSocketsClient";
import ObjectSyncEmitter from "../../component/objectSyncEmitter";
import ObjectSyncReceiver from "../../component/objectSyncReceiver";
import Updatable from "../../interface/updatable";
import World from "../../world";
import GameObject from "./gameObject";

export default abstract class NetworkObject extends GameObject implements Updatable
{
    private objectSyncEmitter: ObjectSyncEmitter | undefined;
    private objectSyncReceiver: ObjectSyncReceiver | undefined;

    constructor(world: World, sourceUserName: string, objectId: string, transform: ObjectTransform)
    {
        super(world, sourceUserName, objectId, transform);
        
        if (this.isMine())
            this.objectSyncEmitter = new ObjectSyncEmitter(this);
        else
            this.objectSyncReceiver = new ObjectSyncReceiver(this);
    }

    onSpawn()
    {
        super.onSpawn();

        if (this.isMine())
        {
            GameSocketsClient.emitObjectSpawn({
                sourceUserName: this.sourceUserName,
                objectType: this.getObjectType(),
                objectId: this.objectId,
                transform: {
                    x: this.position.x,
                    y: this.position.y,
                    z: this.position.z,
                    eulerX: this.rotation.x,
                    eulerY: this.rotation.y,
                    eulerZ: this.rotation.z,
                },
            });
        }
    }

    onDespawn()
    {
        super.onDespawn();

        if (this.isMine())
        {
            GameSocketsClient.emitObjectDespawn({
                objectId: this.objectId,
            });
        }
    }

    onObjectSync(params: ObjectSyncParams)
    {
        this.objectSyncReceiver?.onSyncReceived(params);
    }

    update(deltaTime: number): void
    {
        this.objectSyncEmitter?.update();
        this.objectSyncReceiver?.update();
    }
}