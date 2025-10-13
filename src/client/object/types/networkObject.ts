import ObjectSyncParams from "../../../shared/types/object/objectSyncParams";
import GameSocketsClient from "../../networking/gameSocketsClient";
import ObjectSyncEmitter from "../components/objectSyncEmitter";
import ObjectSyncReceiver from "../components/objectSyncReceiver";
import Updatable from "../interfaces/updatable";
import GameObject from "./gameObject";

export default abstract class NetworkObject extends GameObject implements Updatable
{
    private objectSyncEmitter: ObjectSyncEmitter | undefined;
    private objectSyncReceiver: ObjectSyncReceiver | undefined;

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();

        if (this.isMine())
        {
            this.objectSyncEmitter = new ObjectSyncEmitter(this);
            GameSocketsClient.emitObjectSpawn(this.params);
        }
        else
        {
            this.objectSyncReceiver = new ObjectSyncReceiver(this);
        }
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();

        if (this.isMine())
            GameSocketsClient.emitObjectDespawn({ objectId: this.params.objectId });
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