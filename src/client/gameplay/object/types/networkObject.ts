import ObjectSyncParams from "../../../../shared/types/networking/objectSyncParams";
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

    constructor(world: World, objectId: string, x: number, z: number, angleY: number, mine: boolean)
    {
        super(world, objectId, x, z, angleY);
        
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
                x: this.position.x,
                z: this.position.z,
                angleY: this.rotation.y,
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
    }
}