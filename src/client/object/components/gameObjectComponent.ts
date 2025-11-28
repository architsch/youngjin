import * as THREE from "three";
import GameObject from "../types/gameObject";

export default abstract class GameObjectComponent
{
    gameObject: GameObject;
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
    forceSetPosition?(position: THREE.Vector3): void;
}