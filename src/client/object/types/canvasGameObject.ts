import * as THREE from "three";
import GameObject from "./gameObject";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import InstancedTexturePackMaterialParams from "../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import ClientObjectManager from "../clientObjectManager";
import { CANVAS_FRAME_ATLAS_CELL_SIZE, CANVAS_FRAME_ATLAS_PATH, CANVAS_FRAME_ATLAS_SIZE, CANVAS_GEOMETRY_ID, MAX_CANVASES_PER_ROOM, MAX_WORLDSPACE_SELECT_DIST_SQR } from "../../../shared/system/sharedConstants";
import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import Vec3 from "../../../shared/math/types/vec3";
import { ColliderConfig } from "../../../shared/physics/types/colliderConfig";
import App from "../../app";
import ImageMapUtil from "../../../shared/graphics/image/util/imageMapUtil";
import CanvasFrameInnerWindowMap from "../maps/canvasFrameInnerWindowMap";
import MeshDataUtil from "../../../shared/graphics/mesh/util/meshDataUtil";

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
                2048, 2048, 256, 256, "dynamicEmpty", -1, -1);
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
            CanvasGameObject.materialParams, MAX_CANVASES_PER_ROOM, true);

        this.instanceId = this.instancedMeshGraphics.rentInstanceFromPool(CanvasGameObject.instancedMeshId);
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
        this.instancedMeshGraphics.returnInstanceToPool(CanvasGameObject.instancedMeshId, this.instanceId);

        // Mark as despawned (in order to inform a potentially pending
        // "loadImageImpl" task that the canvas's mesh instance is now obsolete
        // so that the image shouldn't be loaded.)
        this.instanceId = -1;

        CanvasGameObject.spawnedCanvasGameObjects.delete(this.params.objectId);
    }

    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        // Both the picture frame and the image live in the same render-target cell,
        // so any metadata change simply re-draws the whole cell.
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

        ObjectSelection.trySelect(this);
    }

    loadImage(): Promise<void>
    {
        CanvasGameObject.loadQueue = CanvasGameObject.loadQueue.then(() => this.loadImageImpl());
        return CanvasGameObject.loadQueue;
    }

    // Re-draws this canvas's render-target cell: first the chosen picture frame (filling the
    // whole cell), then the canvas's image on top of it (fitted inside the frame's inner window).
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

        // The atlas image is flipped vertically at load time (three.js's default for image
        // textures), so the chosen cell's V range counts rows from the bottom of the atlas
        // image, while the cell coords count them from the top.
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

    // Draws the canvas's image over the frame's inner window (scaled down so it fits inside it).
    private async drawImage(textureIndex: number, frameCellCoords: string)
    {
        const imageDrawScale = CanvasFrameInnerWindowMap.getImageDrawScale(frameCellCoords);

        const metadata = this.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];
        const imageURL = metadata
            ? ImageMapUtil.getImageMap("CanvasImageMap").getImageURLByPath(App.getEnv().assets_url, metadata.str)
            : "";
        try
        {
            // An empty URL paints the placeholder color, which still needs to happen so that
            // the frame's placeholder-colored inner window never shows through.
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

    // Re-bakes this canvas's instance so it follows a cosmetic transform of "visualObj" (e.g.
    // EasingMotion's bounce). The transform is recomputed from the canvas's own state, which composes
    // the moved visual node via InstancedMeshGraphics.
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

        // The canvas's facing already lives in its obj rotation (set from the spawn/update
        // direction), so the instance just faces the object's local forward (+Z). InstancedMeshBinding
        // rotates this local direction into world space by the obj's orientation. The quad sits
        // slightly in front of the wall (assisted by the material's polygon offset).
        this.instancedMeshGraphics.updateInstanceTransform(
            CanvasGameObject.instancedMeshId,
            this.instanceId,
            0, 0, 0.001,
            0, 0, 1,
            sizeX, sizeY, 1);
    }

    // Returns the "{col},{row}" atlas cell coords of this canvas's picture frame, falling back to
    // the first frame in CanvasFrameImageMap when the metadata is absent or invalid.
    private getFrameCellCoords(): string
    {
        const frameImageMap = ImageMapUtil.getImageMap("CanvasFrameImageMap");
        const metadata = this.params.metadata[ObjectMetadataKeyEnumMap.CanvasFrameCoords];
        if (metadata && frameImageMap.hasImagePath(metadata.str))
            return metadata.str;
        return frameImageMap.getFirstImagePath();
    }
}
