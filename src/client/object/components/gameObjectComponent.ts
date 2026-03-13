import * as THREE from "three";
import GameObject from "../types/gameObject";

// Whenever you are implementing a new GameObjectComponent type, you must:
//      (1) Create a class for the new type and make sure that it inherits from GameObjectComponent.
//      (2) Add an entry to ObjectComponentConstructorMap.
//      (3) Place the template of this new type's config inside ObjectTypeConfig.
//      (4) Place the component's config in the appropriate entries in ObjectTypeConfigMap (i.e. GameObjects to which this GameObjectComponent is supposed to belong).
// Whenever you are modifying an existing GameObjectComponent type, you must:
//      (1) Make appropriate modifications to the existing type's class (i.e. the one which inherits from GameObjectComponent).
//      (2) Make appropriate modifications to the existing type's config template in ObjectTypeConfig.
//      (3) Make appropriate modifications to the existing type's component configs in ObjectTypeConfigMap.
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
    trySetPosition?(position: THREE.Vector3): void;
    forceSetTransform?(position: THREE.Vector3, direction: THREE.Vector3): void;
}