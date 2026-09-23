import GameObject from "./gameObject";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import InstancedMeshComposer from "../components/instancedMeshComposer";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import InstancedTexturePackMaterialParams from "../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import CanvasObjectTypeConfig, { CANVAS_TEXTURE_CELL_SIZE,
    CANVAS_TEXTURE_SIZE } from "../../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import ObjectCategoryConfigMap from "../../../shared/object/maps/objectCategoryConfigMap";
import FramedPanelCompositionConstants, { FRAMED_PANEL_BOARD_RELIEF, FRAMED_PANEL_CONTENT_LIFT,
    FRAMED_PANEL_GEOMETRY_ID } from "../../../shared/graphics/mesh/composition/types/compositionConstants/framedPanelCompositionConstants";
import FramedPanelCompositionParams from "../../../shared/graphics/mesh/composition/types/compositionParams/framedPanelCompositionParams";
import { BACKWARD_DIR, ZERO_VEC3 } from "../../../shared/system/sharedConstants";
import Vec3 from "../../../shared/math/types/vec3";
import ObjectScaleUtil from "../../../shared/object/util/objectScaleUtil";
import App from "../../app";
import ImageMapUtil from "../../../shared/graphics/image/util/imageMapUtil";
import MeshDataUtil from "../../../shared/graphics/mesh/util/meshDataUtil";
import { graphicsContextRestoredObservable } from "../../system/clientObservables";

// The frame is composed from the canvas's wood inputs (see CanvasCompositionCodec); the picture is drawn
// here, into this canvas's cell of the room's shared render target, on the board inside its band (or where
// the board would be when there is no frame; see FramedPanelCompositionConstants).
export default class CanvasGameObject extends GameObject
{
    instancedMeshGraphics: InstancedMeshGraphics;
    instancedMeshComposer: InstancedMeshComposer;
    static materialParams: InstancedTexturePackMaterialParams | undefined; // Caching mechanism to minimize computational burden (by preventing repetitive initialization of params)
    static instancedMeshId: string; // Caching mechanism to minimize computational burden (by preventing repetitive initialization of the string)
    static spawnedCanvasGameObjects: Map<string, CanvasGameObject> = new Map();
    private static loadQueue: Promise<void> = Promise.resolve();

    private instanceId: number = -1;

    // The shape the image was last fitted to (see loadImageImpl).
    private placedPictureSize: Vec3 = {...ZERO_VEC3};

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshGraphics = this.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("CanvasGameObject requires InstancedMeshGraphics component");

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("CanvasGameObject requires InstancedMeshComposer component");

        if (CanvasGameObject.materialParams == undefined)
        {
            // Polygon offset beyond the board's (wood draws at -1; see the "InstancedWood" material), on top
            // of the picture's real gap in front of it (see FRAMED_PANEL_CONTENT_LIFT).
            CanvasGameObject.materialParams = new InstancedTexturePackMaterialParams("canvas_texture_pack",
                CANVAS_TEXTURE_SIZE, CANVAS_TEXTURE_SIZE, CANVAS_TEXTURE_CELL_SIZE, CANVAS_TEXTURE_CELL_SIZE,
                "dynamicEmpty", -2, -2);
            // The board, or the wall behind a canvas without a frame, shows around a letterboxed picture
            // (see TextureUtil).
            CanvasGameObject.materialParams.alphaCutout = true;
            CanvasGameObject.instancedMeshId = MeshDataUtil.getInstancedMeshId(
                FRAMED_PANEL_GEOMETRY_ID, CanvasGameObject.materialParams.getMaterialId());
        }
    }

    async onSpawn(): Promise<void>
    {
        if (CanvasGameObject.materialParams == undefined)
            throw new Error(`Canvas material hasn't been defined yet.`);
        await super.onSpawn();

        CanvasGameObject.spawnedCanvasGameObjects.set(this.params.objectId, this);
        // A frame edit moves the picture without moving the canvas.
        this.instancedMeshComposer.partsRebuiltObservable.addListener("canvasGameObject",
            () => this.placePicture());

        await this.instancedMeshGraphics.loadInstancedMesh(FRAMED_PANEL_GEOMETRY_ID,
            CanvasGameObject.materialParams,
            ObjectCategoryConfigMap.getMaxCountPerRoom(CanvasObjectTypeConfig.category), true);

        // An exhausted pool leaves this canvas's picture unrendered.
        const rentedInstanceId = this.instancedMeshGraphics.rentInstanceFromPool(CanvasGameObject.instancedMeshId);
        if (rentedInstanceId == undefined)
            return;

        this.instanceId = rentedInstanceId;
        this.placePicture();
        this.loadImage();
    }

    async onDespawn(): Promise<void>
    {
        this.instancedMeshComposer.partsRebuiltObservable.removeListener("canvasGameObject");
        await super.onDespawn();
        // -1 if it never got an instance.
        if (this.instanceId !== -1)
            this.instancedMeshGraphics.returnInstanceToPool(CanvasGameObject.instancedMeshId, this.instanceId);

        // Tells a pending loadImageImpl that its instance is obsolete.
        this.instanceId = -1;

        CanvasGameObject.spawnedCanvasGameObjects.delete(this.params.objectId);
    }

    onTransformChanged(resized: boolean): void
    {
        super.onTransformChanged(resized);
        this.placePicture();
    }

    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key === ObjectMetadataKeyEnumMap.ImagePath)
            this.loadImage();
    }

    forEachOwnedInstance(visit: (instancedMeshId: string, instanceId: number) => void)
    {
        if (this.instanceId !== -1)
            visit(CanvasGameObject.instancedMeshId, this.instanceId);
    }

    loadImage(): Promise<void>
    {
        CanvasGameObject.loadQueue = CanvasGameObject.loadQueue.then(() => this.loadImageImpl());
        return CanvasGameObject.loadQueue;
    }

    // Redraws the cell with the image's thumbnail (no larger than the cell; see CANVAS_TEXTURE_CELL_SIZE),
    // or the placeholder if there is no image to show. The cell is stretched over the picture, so the image
    // is fitted to the picture's shape rather than the cell's.
    private async loadImageImpl()
    {
        if (this.instanceId === -1) // Already despawned
            return;

        const textureIndex = this.instanceId % 64;
        this.instancedMeshGraphics.updateInstanceTextureUV(CanvasGameObject.instancedMeshId,
            this.instanceId, textureIndex);
        const pictureAspect = this.placedPictureSize.x / this.placedPictureSize.y;

        const metadata = this.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];
        const imageURL = (metadata && metadata.str.length > 0)
            ? ImageMapUtil.getImageMap("CanvasImageMap").getThumbnailURLByPath(App.getEnv().assets_url, metadata.str)
            : "";
        try
        {
            // An empty URL paints the placeholder.
            await this.instancedMeshGraphics.drawImageAtIndex(CanvasGameObject.instancedMeshId,
                textureIndex, imageURL, pictureAspect);
        }
        catch (error)
        {
            console.warn(`Failed to load canvas image (objectId=${this.params.objectId}, value=${metadata?.str}):`, error);
            await this.instancedMeshGraphics.drawImageAtIndex(CanvasGameObject.instancedMeshId,
                textureIndex, "", pictureAspect);
        }
    }

    private getPictureSize(): Vec3
    {
        return FramedPanelCompositionConstants.getInnerSize(
            this.instancedMeshComposer.getParams() as FramedPanelCompositionParams,
            ObjectScaleUtil.getObjectSize(this.params.objectTypeIndex, this.params.transform.scale));
    }

    // Placed on the board's inner surface, inside its band (as a door's label sits inside its plate's), or
    // where the board would be when there is none. Called on movement, resize and frame edits.
    private placePicture()
    {
        if (this.instanceId === -1)
            return;
        const previousSize = this.placedPictureSize;
        this.placedPictureSize = this.getPictureSize();
        this.instancedMeshGraphics.updateInstanceTransform(
            CanvasGameObject.instancedMeshId, this.instanceId,
            0, 0, FRAMED_PANEL_BOARD_RELIEF + FRAMED_PANEL_CONTENT_LIFT, BACKWARD_DIR.x, BACKWARD_DIR.y, BACKWARD_DIR.z,
            this.placedPictureSize.x, this.placedPictureSize.y, this.placedPictureSize.z);

        // The image is fitted to the picture's shape (see loadImageImpl), so a new shape needs it redrawn.
        // The first placement compares equal (against a zero size); onSpawn draws after it.
        if (this.placedPictureSize.x * previousSize.y != this.placedPictureSize.y * previousSize.x)
            void this.loadImage();
    }
}

// Canvas cells live only in a render target (GPU), so every canvas redraws after a context restore.
graphicsContextRestoredObservable.addListener("canvasGameObject", () => {
    CanvasGameObject.spawnedCanvasGameObjects.forEach(
        (canvasGameObject: CanvasGameObject) => void canvasGameObject.loadImage());
});
