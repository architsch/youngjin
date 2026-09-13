import * as THREE from "three";
import GameObject from "./gameObject";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import InstancedTexturePackMaterialParams from "../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import CanvasObjectTypeConfig, { CANVAS_FRAME_ATLAS_CELL_SIZE, CANVAS_FRAME_ATLAS_PATH,
    CANVAS_FRAME_ATLAS_SIZE, CANVAS_GEOMETRY_ID, CANVAS_TEXTURE_CELL_SIZE,
    CANVAS_TEXTURE_SIZE } from "../../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import Vec3 from "../../../shared/math/types/vec3";
import { ColliderConfig } from "../../../shared/physics/types/colliderConfig";
import App from "../../app";
import ImageMapUtil from "../../../shared/graphics/image/util/imageMapUtil";
import CanvasFrameInnerWindowMap from "../maps/canvasFrameInnerWindowMap";
import MeshDataUtil from "../../../shared/graphics/mesh/util/meshDataUtil";
import { graphicsContextRestoredObservable } from "../../system/clientObservables";

export default class CanvasGameObject extends GameObject
{
    instancedMeshGraphics: InstancedMeshGraphics;
    static materialParams: InstancedTexturePackMaterialParams | undefined; // Caching mechanism to minimize computational burden (by preventing repetitive initialization of params)
    static instancedMeshId: string; // Caching mechanism to minimize computational burden (by preventing repetitive initialization of the string)
    static spawnedCanvasGameObjects: Map<string, CanvasGameObject> = new Map();
    private static loadQueue: Promise<void> = Promise.resolve();

    private instanceId: number = -1;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshGraphics = this.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("CanvasGameObject requires InstancedMeshGraphics component");

        if (CanvasGameObject.materialParams == undefined)
        {
            // The polygon-offset values are -1 because the mesh must not z-fight with the wall behind it.
            CanvasGameObject.materialParams = new InstancedTexturePackMaterialParams("canvas_texture_pack",
                CANVAS_TEXTURE_SIZE, CANVAS_TEXTURE_SIZE, CANVAS_TEXTURE_CELL_SIZE, CANVAS_TEXTURE_CELL_SIZE,
                "dynamicEmpty", -1, -1);
            CanvasGameObject.instancedMeshId = MeshDataUtil.getInstancedMeshId(
                CANVAS_GEOMETRY_ID, CanvasGameObject.materialParams.getMaterialId());
        }
    }

    async onSpawn(): Promise<void>
    {
        if (CanvasGameObject.materialParams == undefined)
            throw new Error(`Canvas material hasn't been defined yet.`);
        await super.onSpawn();

        CanvasGameObject.spawnedCanvasGameObjects.set(this.params.objectId, this);

        await this.instancedMeshGraphics.loadInstancedMesh(CANVAS_GEOMETRY_ID,
            CanvasGameObject.materialParams, CanvasObjectTypeConfig.maxCountPerRoom, true);

        // An exhausted pool leaves this canvas unrendered.
        const rentedInstanceId = this.instancedMeshGraphics.rentInstanceFromPool(CanvasGameObject.instancedMeshId);
        if (rentedInstanceId == undefined)
            return;

        this.instanceId = rentedInstanceId;
        this.updateMeshInstanceTransform();
        this.loadImage();
    }

    setObjectTransform(pos: Vec3, dir: Vec3)
    {
        super.setObjectTransform(pos, dir);
        this.updateMeshInstanceTransform();
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();
        // -1 if it never got an instance.
        if (this.instanceId !== -1)
            this.instancedMeshGraphics.returnInstanceToPool(CanvasGameObject.instancedMeshId, this.instanceId);

        // Tells a pending loadImageImpl that its instance is obsolete.
        this.instanceId = -1;

        CanvasGameObject.spawnedCanvasGameObjects.delete(this.params.objectId);
    }

    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        // Frame and image share one cell, so any metadata change redraws the whole cell.
        this.loadImage();
    }

    loadImage(): Promise<void>
    {
        CanvasGameObject.loadQueue = CanvasGameObject.loadQueue.then(() => this.loadImageImpl());
        return CanvasGameObject.loadQueue;
    }

    // Redraws the cell: the frame first, then the image fitted inside its inner window.
    private async loadImageImpl()
    {
        if (this.instanceId === -1) // Already despawned
            return;

        const textureIndex = this.instanceId % 64;
        this.instancedMeshGraphics.updateInstanceTextureUV(CanvasGameObject.instancedMeshId,
            this.instanceId, textureIndex);

        const frameCellCoords = this.getFrameCellCoords();
        await this.drawFrame(textureIndex, frameCellCoords);
        await this.drawImage(textureIndex, frameCellCoords);
    }

    // Draws the chosen picture frame's atlas cell so it fills this canvas's render-target cell.
    private async drawFrame(textureIndex: number, frameCellCoords: string)
    {
        const words = frameCellCoords.split(",");
        const col = parseInt(words[0]);
        const row = parseInt(words[1]);

        // Texture V counts rows from the bottom; cell coords count from the top.
        const numCols = CANVAS_FRAME_ATLAS_SIZE / CANVAS_FRAME_ATLAS_CELL_SIZE;
        const numRows = CANVAS_FRAME_ATLAS_SIZE / CANVAS_FRAME_ATLAS_CELL_SIZE;
        const frameAtlasURL = `${App.getEnv().assets_url}/${CANVAS_FRAME_ATLAS_PATH}`;
        try
        {
            await this.instancedMeshGraphics.drawImageAtIndex(CanvasGameObject.instancedMeshId,
                textureIndex, frameAtlasURL, 1, 1,
                col / numCols, (numRows - 1 - row) / numRows,
                (col + 1) / numCols, (numRows - row) / numRows,
                false);
        }
        catch (error)
        {
            console.warn(`Failed to load canvas frame (objectId=${this.params.objectId}, coords=${frameCellCoords}):`, error);
            // Paint a placeholder color so the cell isn't stuck showing the old frame
            await this.instancedMeshGraphics.drawImageAtIndex(CanvasGameObject.instancedMeshId,
                textureIndex, "");
        }
    }

    // Draws the image's thumbnail (no larger than the cell; see CANVAS_TEXTURE_CELL_SIZE) into the
    // frame's inner window.
    private async drawImage(textureIndex: number, frameCellCoords: string)
    {
        const imageDrawScale = CanvasFrameInnerWindowMap.getImageDrawScale(frameCellCoords);

        const metadata = this.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];
        const imageURL = metadata
            ? ImageMapUtil.getImageMap("CanvasImageMap").getThumbnailURLByPath(App.getEnv().assets_url, metadata.str)
            : "";
        try
        {
            // An empty URL still paints the placeholder, covering the frame's placeholder window.
            await this.instancedMeshGraphics.drawImageAtIndex(CanvasGameObject.instancedMeshId,
                textureIndex, imageURL, imageDrawScale, imageDrawScale);
        }
        catch (error)
        {
            console.warn(`Failed to load canvas image (objectId=${this.params.objectId}, value=${metadata?.str}):`, error);
            // Paint a placeholder color so the canvas isn't stuck showing the old image
            await this.instancedMeshGraphics.drawImageAtIndex(CanvasGameObject.instancedMeshId,
                textureIndex, "", imageDrawScale, imageDrawScale);
        }
    }

    // Re-bakes the instance to follow visualObj's cosmetic transform (e.g. EasingMotion).
    onVisualTransformChanged(): void
    {
        this.updateMeshInstanceTransform();
    }

    private updateMeshInstanceTransform()
    {
        if (this.instanceId === -1)
            return;

        const colliderConfig = this.components.collider.componentConfig as ColliderConfig;
        const sizeX = colliderConfig.hitboxSize.sizeX;
        const sizeY = colliderConfig.hitboxSize.sizeY;

        // Facing is in obj's rotation, so the instance faces local +Z; the polygon offset keeps it
        // in front of the wall.
        this.instancedMeshGraphics.updateInstanceTransform(
            CanvasGameObject.instancedMeshId,
            this.instanceId,
            0, 0, 0.001,
            0, 0, 1,
            sizeX, sizeY, 1);
    }

    // Falls back to the first frame when metadata is absent or invalid.
    private getFrameCellCoords(): string
    {
        const frameImageMap = ImageMapUtil.getImageMap("CanvasFrameImageMap");
        const metadata = this.params.metadata[ObjectMetadataKeyEnumMap.CanvasFrameCoords];
        if (metadata && frameImageMap.hasImagePath(metadata.str))
            return metadata.str;
        return frameImageMap.getFirstImagePath();
    }
}

// Canvas cells live only in a render target (GPU), so every canvas redraws after a context restore.
graphicsContextRestoredObservable.addListener("canvasGameObject", () => {
    CanvasGameObject.spawnedCanvasGameObjects.forEach(
        (canvasGameObject: CanvasGameObject) => void canvasGameObject.loadImage());
});
