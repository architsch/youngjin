import * as THREE from "three";
import GameObject from "./gameObject";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import ObjectSpawnParams from "../../../shared/object/types/objectSpawnParams";
import TexturePackMaterialParams from "../../graphics/types/material/texturePackMaterialParams";
import ObjectManager from "../objectManager";
import { MAX_WORLDSPACE_SELECT_DIST_SQR } from "../../../shared/system/sharedConstants";
import PersistentObjectSelection from "../../graphics/types/gizmo/persistentObjectSelection";
import { roomChangedObservable } from "../../system/clientObservables";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";

export default class CanvasGameObject extends GameObject
{
    instancedMeshGraphics: InstancedMeshGraphics;

    private instanceId: number = -1;

    static spawnedCanvasGameObjects: Map<string, CanvasGameObject> = new Map();

    constructor(params: ObjectSpawnParams)
    {
        super(params);

        this.instancedMeshGraphics = this.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("CanvasGameObject requires InstancedMeshGraphics component");

        const materialParams = new TexturePackMaterialParams("canvas_texture_pack",
            2048, 2048, 256, 256, "dynamicEmpty");
        this.instancedMeshGraphics.setInstancingProperties(materialParams,
            "Square", 512);
    }

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();
        await this.instancedMeshGraphics.loadInstancedMesh();
        this.instanceId = this.instancedMeshGraphics.rentInstanceFromPool();
        const { dirX, dirY, dirZ } = this.params.transform;
        this.instancedMeshGraphics.updateInstanceTransform(
            this.instanceId, 0, 0, 0.01, dirX, dirY, dirZ, 1, 1, 1); // The offset of 0.01 along the local +z axis (wall normal) prevents z-fighting with the wall.

        CanvasGameObject.spawnedCanvasGameObjects.set(this.params.objectId, this);
    }

    async onDespawn(): Promise<void>
    {
        CanvasGameObject.spawnedCanvasGameObjects.delete(this.params.objectId);

        await super.onDespawn();
        this.instancedMeshGraphics.returnInstanceToPool(this.instanceId);
    }

    onClick(instanceId: number, hitPoint: THREE.Vector3)
    {
        const player = ObjectManager.getMyPlayer();
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

    async loadImage()
    {
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

    static async loadAllImagesByDistance(): Promise<void>
    {
        const player = ObjectManager.getMyPlayer();
        if (!player)
            return;

        const canvases = Array.from(CanvasGameObject.spawnedCanvasGameObjects.values());
        canvases.sort((a, b) => {
            const distA = a.position.distanceToSquared(player.position);
            const distB = b.position.distanceToSquared(player.position);
            return distA - distB;
        });

        for (const canvas of canvases)
        {
            await canvas.loadImage();
        }
    }
}

// After the room is fully loaded, sequentially load all canvas images
// starting from the one closest to the player.
roomChangedObservable.addListener("canvasGameObject", async (_roomRuntimeMemory: RoomRuntimeMemory) => {
    await CanvasGameObject.loadAllImagesByDistance();
});
