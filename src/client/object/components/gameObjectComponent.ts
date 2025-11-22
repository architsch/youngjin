import * as THREE from "three";
import ObjectMessageParams from "../../../shared/object/types/objectMessageParams";
import GameObject from "../types/gameObject";
import ObjectDesyncResolveParams from "../../../shared/object/types/objectDesyncResolveParams";
import ObjectSyncParams from "../../../shared/object/types/objectSyncParams";
import Voxel from "../../../shared/voxel/types/voxel";

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
    onObjectMessageReceived?(params: ObjectMessageParams): void;
    onObjectDesyncResolveReceived?(params: ObjectDesyncResolveParams): void;
    onObjectSyncReceived?(params: ObjectSyncParams): void;
    getVoxel?(): Voxel;
    setVoxel?(voxel: Voxel): void;
}