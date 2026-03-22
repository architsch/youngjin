import * as THREE from "three";
import GameObject from "./gameObject";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import TexturePackMaterialParams from "../../graphics/types/material/texturePackMaterialParams";
import ClientObjectManager from "../clientObjectManager";
import { MAX_CANVASES_PER_ROOM, MAX_WORLDSPACE_SELECT_DIST_SQR } from "../../../shared/system/sharedConstants";
import PersistentObjectSelection from "../../graphics/types/gizmo/persistentObjectSelection";
import Vec3 from "../../../shared/math/types/vec3";

export default class CanvasGameObject extends GameObject
{
    instancedMeshGraphics: InstancedMeshGraphics;

    static spawnedCanvasGameObjects: Map<string, CanvasGameObject> = new Map();
    private static loadQueue: Promise<void> = Promise.resolve();

    private instanceId: number = -1;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshGraphics = this.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("CanvasGameObject requires InstancedMeshGraphics component");

        const materialParams = new TexturePackMaterialParams("canvas_texture_pack",
            2048, 2048, 256, 256, "dynamicEmpty");
        this.instancedMeshGraphics.setInstancingProperties(materialParams,
            "Square", MAX_CANVASES_PER_ROOM);
    }

    async onSpawn(): Promise<void>
    {
        CanvasGameObject.spawnedCanvasGameObjects.set(this.params.objectId, this);

        await super.onSpawn();

        await this.instancedMeshGraphics.loadInstancedMesh();

        this.instanceId = this.instancedMeshGraphics.rentInstanceFromPool();
        const tr = this.params.transform;

        this.instancedMeshGraphics.updateInstanceTransform(
            this.instanceId,
            0, 0, 0.001,
            tr.dir.x, tr.dir.y, tr.dir.z,
            1, 1, 1);

        this.loadImage();
    }

    setObjectTransform(pos: Vec3, dir: Vec3)
    {
        super.setObjectTransform(pos, dir);

        if (this.instanceId === -1)
            return;
        this.instancedMeshGraphics.updateInstanceTransform(
            this.instanceId,
            0, 0, 0.001,
            this.direction.x, this.direction.y, this.direction.z,
            1, 1, 1);
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();
        this.instancedMeshGraphics.returnInstanceToPool(this.instanceId);

        // Mark as despawned (in order to inform a potentially pending
        // "loadImageImpl" task that the canvas's mesh instance is now obsolete
        // so that the image shouldn't be loaded.)
        this.instanceId = -1;

        CanvasGameObject.spawnedCanvasGameObjects.delete(this.params.objectId);
    }

    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        this.loadImage();
    }

    onClick(instanceId: number, hitPoint: THREE.Vector3)
    {
        const player = ClientObjectManager.getMyPlayer();
        if (player == undefined)
        {
            console.error("My player not found in CanvasGameObject's onClick.");
            return;
        }
        const distSqr = hitPoint.distanceToSquared(player.position);
        if (distSqr > MAX_WORLDSPACE_SELECT_DIST_SQR)
            return;

        PersistentObjectSelection.trySelect(this);
    }

    loadImage(): Promise<void>
    {
        CanvasGameObject.loadQueue = CanvasGameObject.loadQueue.then(() => this.loadImageImpl());
        return CanvasGameObject.loadQueue;
    }

    private async loadImageImpl()
    {
        if (this.instanceId === -1) // Already despawned
            return;
        if (!this.params.hasMetadata(ObjectMetadataKeyEnumMap.ImageURL))
            return;
        const imageURL = this.params.getMetadata(ObjectMetadataKeyEnumMap.ImageURL);
        try
        {
            this.instancedMeshGraphics.updateInstanceTextureUV(this.instanceId, this.instanceId % 64);
            await this.instancedMeshGraphics.drawImageAtIndex(this.instanceId % 64, imageURL);
        }
        catch (error)
        {
            console.warn(`Failed to load canvas image (objectId=${this.params.objectId}, url=${imageURL}):`, error);
            // Paint a placeholder color so the canvas isn't stuck showing the old image
            await this.instancedMeshGraphics.drawImageAtIndex(this.instanceId % 64, "");
        }
    }
}
