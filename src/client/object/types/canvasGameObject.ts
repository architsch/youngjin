import * as THREE from "three";
import GameObject from "./gameObject";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import InstancedMeshComposer from "../components/instancedMeshComposer";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import InstancedTexturePackMaterialParams from "../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import InstancedMeshCompositionPart from "../../../shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import CanvasObjectTypeConfig, { CANVAS_TEXTURE_CELL_SIZE,
    CANVAS_TEXTURE_SIZE } from "../../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import { CANVAS_BOARD_RELIEF, CANVAS_FOOTPRINT_HEIGHT, CANVAS_FOOTPRINT_WIDTH,
    CANVAS_GEOMETRY_ID, CANVAS_PICTURE_LIFT } from "../../../shared/graphics/mesh/composition/types/compositionConstants/canvasCompositionConstants";
import { BACKWARD_DIR, INSTANCED_WOOD_MATERIAL_ID } from "../../../shared/system/sharedConstants";
import App from "../../app";
import ImageMapUtil from "../../../shared/graphics/image/util/imageMapUtil";
import MeshDataUtil from "../../../shared/graphics/mesh/util/meshDataUtil";
import { graphicsContextRestoredObservable } from "../../system/clientObservables";

// The frame is composed from the canvas's wood inputs (see CanvasCompositionCodec); the picture is drawn
// here, into this canvas's cell of the room's shared render target, on the board inside its band (or across
// the whole footprint when there is no frame).
export default class CanvasGameObject extends GameObject
{
    instancedMeshGraphics: InstancedMeshGraphics;
    instancedMeshComposer: InstancedMeshComposer;
    static materialParams: InstancedTexturePackMaterialParams | undefined; // Caching mechanism to minimize computational burden (by preventing repetitive initialization of params)
    static instancedMeshId: string; // Caching mechanism to minimize computational burden (by preventing repetitive initialization of the string)
    static spawnedCanvasGameObjects: Map<string, CanvasGameObject> = new Map();
    private static loadQueue: Promise<void> = Promise.resolve();

    private instanceId: number = -1;

    // What the picture was last placed by. Parts are replaced whenever the frame is recomposed (e.g. a
    // customization edit), and the world matrix changes with movement.
    private placedBoard: InstancedMeshCompositionPart | undefined;
    private bakedWorldMatrix: THREE.Matrix4 = new THREE.Matrix4();

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
            // of the picture's real gap in front of it (see CANVAS_PICTURE_LIFT).
            CanvasGameObject.materialParams = new InstancedTexturePackMaterialParams("canvas_texture_pack",
                CANVAS_TEXTURE_SIZE, CANVAS_TEXTURE_SIZE, CANVAS_TEXTURE_CELL_SIZE, CANVAS_TEXTURE_CELL_SIZE,
                "dynamicEmpty", -2, -2);
            // The board, or the wall behind a canvas without a frame, shows around a letterboxed picture
            // (see TextureUtil).
            CanvasGameObject.materialParams.alphaCutout = true;
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

        // An exhausted pool leaves this canvas's picture unrendered.
        const rentedInstanceId = this.instancedMeshGraphics.rentInstanceFromPool(CanvasGameObject.instancedMeshId);
        if (rentedInstanceId == undefined)
            return;

        this.instanceId = rentedInstanceId;
        this.updateMeshInstanceTransform();
        this.loadImage();
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

    update(deltaTime: number): void
    {
        if (this.instanceId !== -1 && !this.placementIsInSync())
            this.updateMeshInstanceTransform();
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

    // Redraws the cell: cleared to transparent (the fitted image may not cover a previous occupant's),
    // then the image's thumbnail (no larger than the cell; see CANVAS_TEXTURE_CELL_SIZE), or the
    // placeholder if there is no image to show.
    private async loadImageImpl()
    {
        if (this.instanceId === -1) // Already despawned
            return;

        const textureIndex = this.instanceId % 64;
        this.instancedMeshGraphics.updateInstanceTextureUV(CanvasGameObject.instancedMeshId,
            this.instanceId, textureIndex);
        this.instancedMeshGraphics.drawCanvasAtIndex(CanvasGameObject.instancedMeshId,
            textureIndex, getTransparentCanvas());

        const metadata = this.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];
        const imageURL = (metadata && metadata.str.length > 0)
            ? ImageMapUtil.getImageMap("CanvasImageMap").getThumbnailURLByPath(App.getEnv().assets_url, metadata.str)
            : "";
        try
        {
            // An empty URL paints the placeholder.
            await this.instancedMeshGraphics.drawImageAtIndex(CanvasGameObject.instancedMeshId,
                textureIndex, imageURL);
        }
        catch (error)
        {
            console.warn(`Failed to load canvas image (objectId=${this.params.objectId}, value=${metadata?.str}):`, error);
            await this.instancedMeshGraphics.drawImageAtIndex(CanvasGameObject.instancedMeshId,
                textureIndex, "");
        }
    }

    private placementIsInSync(): boolean
    {
        if (this.instancedMeshComposer.getPartWithMaterial(INSTANCED_WOOD_MATERIAL_ID) !== this.placedBoard)
            return false;
        this.obj.updateMatrixWorld(); // Recurses to visualObj, so the compared matrix is current.
        return this.visualObj.matrixWorld.equals(this.bakedWorldMatrix);
    }

    // Placed on the board's inner surface, inside its band (as a door's label sits inside its plate's). The
    // board always spans the footprint, so without one the picture spans it instead.
    private updateMeshInstanceTransform()
    {
        const board = this.instancedMeshComposer.getPartWithMaterial(INSTANCED_WOOD_MATERIAL_ID);
        this.placedBoard = board;
        const inset = board ? 2 * board.mouldingThickness : 0;
        this.instancedMeshGraphics.updateInstanceTransform(
            CanvasGameObject.instancedMeshId, this.instanceId,
            0, 0, CANVAS_BOARD_RELIEF + CANVAS_PICTURE_LIFT, BACKWARD_DIR.x, BACKWARD_DIR.y, BACKWARD_DIR.z,
            CANVAS_FOOTPRINT_WIDTH - inset, CANVAS_FOOTPRINT_HEIGHT - inset, 1);

        this.obj.updateMatrixWorld();
        this.bakedWorldMatrix.copy(this.visualObj.matrixWorld);
    }
}

// A blank canvas, drawn over a cell to clear it (the draw replaces rather than blends; see TextureUtil).
let transparentCanvas: HTMLCanvasElement | undefined;
function getTransparentCanvas(): HTMLCanvasElement
{
    if (transparentCanvas == undefined)
    {
        transparentCanvas = document.createElement("canvas");
        transparentCanvas.width = 1;
        transparentCanvas.height = 1;
    }
    return transparentCanvas;
}

// Canvas cells live only in a render target (GPU), so every canvas redraws after a context restore.
graphicsContextRestoredObservable.addListener("canvasGameObject", () => {
    CanvasGameObject.spawnedCanvasGameObjects.forEach(
        (canvasGameObject: CanvasGameObject) => void canvasGameObject.loadImage());
});
