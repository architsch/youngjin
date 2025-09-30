import ObjectSyncParams from "../../../../shared/types/networking/objectSyncParams";
import ObjectTransform from "../../../../shared/types/networking/objectTransform";
import GameSocketsClient from "../../../networking/gameSocketsClient";
import ObjectSyncEmitter from "../../component/objectSyncEmitter";
import ObjectSyncReceiver from "../../component/objectSyncReceiver";
import Updatable from "../../interface/updatable";
import World from "../../world";
import GameObject from "./gameObject";

export default abstract class NetworkObject extends GameObject implements Updatable
{
    private mine: boolean;
    private objectSyncEmitter: ObjectSyncEmitter | undefined;
    private objectSyncReceiver: ObjectSyncReceiver | undefined;

    constructor(world: World, objectId: string, transform: ObjectTransform, mine: boolean)
    {
        super(world, objectId, transform);
        
        this.mine = mine;
        if (mine)
            this.objectSyncEmitter = new ObjectSyncEmitter(this);
        else
            this.objectSyncReceiver = new ObjectSyncReceiver(this);

        
    }

    isMine(): boolean
    {
        return this.mine;
    }

    onSpawn()
    {
        super.onSpawn();

        if (this.mine)
        {
            GameSocketsClient.emitObjectSpawn({
                objectType: this.constructor.name,
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

        if (this.mine)
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