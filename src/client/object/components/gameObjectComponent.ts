import GameObject from "../types/gameObject";
import { ObjectMetadataKey } from "../../../shared/object/types/objectMetadataKey";

// A new component type needs: a GameObjectComponent subclass, an ObjectComponentConstructorMap entry,
// a config template in ObjectTypeConfig, and configs in ObjectTypeConfigMap for the objects that use it.
export default abstract class GameObjectComponent
{
    gameObject: GameObject; // This is the GameObject to which this GameObjectComponent belongs.
    componentConfig: {[key: string]: any};

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        this.gameObject = gameObject;
        this.componentConfig = componentConfig;
    }

    async onSpawn?(): Promise<void>;
    async onDespawn?(): Promise<void>;
    update?(deltaTime: number): void;
    onSetMetadata?(key: ObjectMetadataKey, value: string): void;
}