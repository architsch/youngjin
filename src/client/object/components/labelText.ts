import GameObjectComponent from "./gameObjectComponent";
import GameObject from "../types/gameObject";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import InstancedTexturePackMaterialParams from "../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import MeshDataUtil from "../../../shared/graphics/mesh/util/meshDataUtil";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { LABEL_ATLAS_CELL_SIZE, LABEL_ATLAS_CELL_WORLD_SIZE, LABEL_ATLAS_SIZE, LABEL_COLOR_PALETTE_NAME,
    LABEL_GEOMETRY_ID, LABEL_PIXELS_PER_WORLD_UNIT } from "../../../shared/system/sharedConstants";
import ColorUtil from "../../../shared/math/util/colorUtil";
import Transform from "../../../shared/math/types/transform";
import Vec2 from "../../../shared/math/types/vec2";
import Vec3 from "../../../shared/math/types/vec3";
import ObjectScaleUtil from "../../../shared/object/util/objectScaleUtil";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectCategoryConfigMap from "../../../shared/object/maps/objectCategoryConfigMap";
import LabelTextUtil from "../../../shared/object/util/labelTextUtil";
import LabelTextLayoutUtil from "../util/labelTextLayoutUtil";
import TextureAtlasAllocator from "../../graphics/types/textureAtlasAllocator";
import TextureAtlasRegion from "../../graphics/types/textureAtlasRegion";
import { graphicsContextRestoredObservable } from "../../system/clientObservables";

// An object's "Label" text, drawn onto a patch of the object in the scene (not an HTML overlay), so walls
// occlude it. All labels in a room share one mesh and one atlas (one draw call). Each label holds a region
// of the atlas sized to its patch in whole cells, so only a resize reallocates it.

// Inner margin of the text area, in world units.
const PADDING = 0.025;

// Measured once at this size and scaled, since text metrics scale linearly.
const MEASURING_FONT_SIZE_PX = 64;

// Roman serif, as on brass plates and signwriting.
const FONT_FAMILY = "'Times New Roman', Times, serif";

const NUM_ATLAS_CELLS_PER_SIDE = LABEL_ATLAS_SIZE / LABEL_ATLAS_CELL_SIZE;

export default class LabelText extends GameObjectComponent
{
    private static materialParams: InstancedTexturePackMaterialParams | undefined;
    private static instancedMeshId: string;
    private static atlasAllocator = new TextureAtlasAllocator(NUM_ATLAS_CELLS_PER_SIDE,
        NUM_ATLAS_CELLS_PER_SIDE);

    private instancedMeshGraphics: InstancedMeshGraphics;
    private instanceId: number = -1;
    private region: TextureAtlasRegion | undefined;
    // The region's size this label asks for, kept for a repack (see repack).
    private wantedNumCols: number = 0;
    private wantedNumRows: number = 0;
    // The part of the patch the text keeps to, in world units, when the object narrows it.
    private contentSize: Vec2 | undefined;

    // Work is deferred to update(), so the several notices one edit can cause (e.g. a resize, and the
    // frame that resize rebuilds) are applied once.
    private spawned: boolean = false;
    private needsAllocation: boolean = false;
    private needsPlacement: boolean = false;
    private needsDrawing: boolean = false;
    private needsColoring: boolean = false;

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);

        this.instancedMeshGraphics = gameObject.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("LabelText requires InstancedMeshGraphics component");

        if (LabelText.materialParams == undefined)
        {
            // Negative polygon offset: the quad sits flat on a surface.
            LabelText.materialParams = new InstancedTexturePackMaterialParams("label_text",
                LABEL_ATLAS_SIZE, LABEL_ATLAS_SIZE,
                LABEL_ATLAS_CELL_SIZE, LABEL_ATLAS_CELL_SIZE,
                "dynamicEmpty", -1, -1,
                true /* see-through around the lettering */,
                "linear" /* a glyph's edges are its legibility (see TextureFilterType) */);
            // Every label is one ink, so the atlas holds only the lettering's coverage.
            LabelText.materialParams.coverageOnly = true;
            LabelText.instancedMeshId = MeshDataUtil.getInstancedMeshId(
                LABEL_GEOMETRY_ID, LabelText.materialParams.getMaterialId());
        }
    }

    async onSpawn(): Promise<void>
    {
        await this.instancedMeshGraphics.loadInstancedMesh(LABEL_GEOMETRY_ID,
            LabelText.materialParams!, getMaxLabelsPerRoom(), true);
        spawnedLabelTexts.add(this);
        this.spawned = true;
        this.needsAllocation = true;
        this.needsDrawing = true;
    }

    async onDespawn(): Promise<void>
    {
        spawnedLabelTexts.delete(this);
        this.spawned = false;
        this.releaseInstance();
        this.freeRegion();
    }

    onTransformChanged(resized: boolean): void
    {
        this.needsPlacement = true;
        if (resized)
        {
            this.needsAllocation = true;
            this.needsDrawing = true;
        }
    }

    onSetMetadata(key: ObjectMetadataKey, value: string): void
    {
        if (key === ObjectMetadataKeyEnumMap.Label || key === ObjectMetadataKeyEnumMap.LabelFont)
            this.needsDrawing = true;
        else if (key === ObjectMetadataKeyEnumMap.LabelColor)
            this.needsColoring = true;
    }

    // For an object that frames its text (e.g. a label's board): the text keeps to this size, centred on
    // the patch, instead of filling it. Undefined fills the patch again. Never reallocates.
    setContentSize(size: Vec2 | undefined): void
    {
        if (size?.x === this.contentSize?.x && size?.y === this.contentSize?.y)
            return;
        this.contentSize = (size != undefined) ? {x: size.x, y: size.y} : undefined;
        this.needsPlacement = true;
        this.needsDrawing = true;
    }

    update(deltaTime: number): void
    {
        if (!this.spawned)
            return;
        if (this.needsAllocation)
        {
            this.needsAllocation = false;
            this.allocateRegion();
        }
        // Without a region there is nothing to show.
        if (this.region == undefined)
        {
            this.releaseInstance();
            return;
        }
        // The pool may be exhausted; the label then stays undrawn until an instance frees up.
        if (this.instanceId === -1 && !this.rentInstance())
            return;

        if (this.needsPlacement)
        {
            this.needsPlacement = false;
            this.place();
        }
        if (this.needsColoring)
        {
            this.needsColoring = false;
            const rgb = ColorUtil.hexToRGB(this.getFontColorHex());
            this.instancedMeshGraphics.updateInstanceColor(LabelText.instancedMeshId, this.instanceId,
                rgb.x, rgb.y, rgb.z);
        }
        if (this.needsDrawing)
        {
            this.needsDrawing = false;
            this.instancedMeshGraphics.drawCanvasAtTexel(LabelText.instancedMeshId,
                this.region.col * LABEL_ATLAS_CELL_SIZE, this.region.row * LABEL_ATLAS_CELL_SIZE,
                this.renderTextToCanvas());
        }
    }

    // For when the atlas's contents were lost, not replaced (context restore, below).
    redrawLostContents(): void
    {
        this.needsDrawing = true;
    }

    // So whole-object actions (e.g. occlusion hiding) also reach the label (see OrbitOcclusionHider).
    forEachInstance(visit: (instancedMeshId: string, instanceId: number) => void)
    {
        if (this.instanceId !== -1)
            visit(LabelText.instancedMeshId, this.instanceId);
    }

    // The patch in the object's local space: localTransform with the object's scale applied (see
    // ObjectTypeConfig).
    private getPatch(): {pos: Vec3, dir: Vec3, size: Vec2}
    {
        const localTransform = this.componentConfig.localTransform as Transform;
        const scale = ObjectScaleUtil.sanitize(this.gameObject.params.objectTypeIndex,
            this.gameObject.params.transform.scale);
        return {
            pos: {
                x: localTransform.pos.x * scale.x,
                y: localTransform.pos.y * scale.y,
                z: localTransform.pos.z * scale.z,
            },
            dir: localTransform.dir,
            size: {x: localTransform.scale.x * scale.x, y: localTransform.scale.y * scale.y},
        };
    }

    // The text area in atlas pixels (the same density at any size), within the region.
    private getTextAreaPixels(): {width: number, height: number}
    {
        const size = this.contentSize ?? this.getPatch().size;
        const toPixels = (worldSize: number, numCells: number) => Math.max(1,
            Math.min(numCells * LABEL_ATLAS_CELL_SIZE, Math.round(worldSize * LABEL_PIXELS_PER_WORLD_UNIT)));
        return {
            width: toPixels(size.x, this.region!.numCols),
            height: toPixels(size.y, this.region!.numRows),
        };
    }

    // Keeps the region when its size in cells still fits the patch.
    private allocateRegion(): void
    {
        const size = this.getPatch().size;
        // Less a hair, so a patch of exactly n cells isn't rounded up to n + 1.
        const numCols = Math.max(1, Math.ceil(size.x / LABEL_ATLAS_CELL_WORLD_SIZE - 1e-6));
        const numRows = Math.max(1, Math.ceil(size.y / LABEL_ATLAS_CELL_WORLD_SIZE - 1e-6));
        if (this.region != undefined && this.region.numCols == numCols && this.region.numRows == numRows)
            return;

        this.freeRegion();
        this.wantedNumCols = numCols;
        this.wantedNumRows = numRows;
        this.region = LabelText.atlasAllocator.allocate(numCols, numRows);
        if (this.region == undefined)
            LabelText.repack();
        this.needsPlacement = true;
        this.needsDrawing = true;
    }

    private freeRegion(): void
    {
        if (this.region == undefined)
            return;
        LabelText.atlasAllocator.free(this.region);
        this.region = undefined;
    }

    // Only reached when fragmentation leaves no room for a region (the room caps guarantee the space):
    // every label is packed again from scratch, largest first, and redrawn where it lands.
    private static repack(): void
    {
        console.warn("LabelText :: The label atlas is fragmented, so every label is being packed again");
        LabelText.atlasAllocator.clear();
        const labels = [...spawnedLabelTexts]
            .filter(label => label.wantedNumCols > 0)
            .sort((a, b) => b.wantedNumCols * b.wantedNumRows - a.wantedNumCols * a.wantedNumRows);
        for (const label of labels)
        {
            label.region = LabelText.atlasAllocator.allocate(label.wantedNumCols, label.wantedNumRows);
            if (label.region == undefined)
                console.warn(`LabelText :: No room in the label atlas (objectId = ${label.gameObject.params.objectId})`);
            label.needsPlacement = true;
            label.needsDrawing = true;
        }
    }

    private rentInstance(): boolean
    {
        const rentedInstanceId = this.instancedMeshGraphics.rentInstanceFromPool(LabelText.instancedMeshId);
        if (rentedInstanceId == undefined)
            return false;
        this.instanceId = rentedInstanceId;
        this.needsPlacement = true;
        this.needsColoring = true;
        return true;
    }

    private releaseInstance(): void
    {
        if (this.instanceId === -1)
            return;
        this.instancedMeshGraphics.returnInstanceToPool(LabelText.instancedMeshId, this.instanceId);
        this.instanceId = -1;
    }

    // The quad covers the text area, centred on the patch, and samples exactly the pixels drawn for it.
    private place(): void
    {
        const patch = this.getPatch();
        const size = this.contentSize ?? patch.size;
        this.instancedMeshGraphics.updateInstanceTransform(
            LabelText.instancedMeshId, this.instanceId,
            patch.pos.x, patch.pos.y, patch.pos.z,
            patch.dir.x, patch.dir.y, patch.dir.z,
            size.x, size.y, 1);

        const {width, height} = this.getTextAreaPixels();
        this.instancedMeshGraphics.updateInstanceTextureRect(LabelText.instancedMeshId, this.instanceId,
            this.region!.col * LABEL_ATLAS_CELL_SIZE, this.region!.row * LABEL_ATLAS_CELL_SIZE,
            width, height);
    }

    // The object's chosen ink color, falling back to its type default.
    private getFontColorHex(): string
    {
        const stored = this.gameObject.params.metadata[ObjectMetadataKeyEnumMap.LabelColor]?.str;
        if (stored != undefined && stored.length > 0)
        {
            const index = parseInt(stored);
            if (!isNaN(index))
            {
                return ColorUtil.rgbToHex(
                    ColorUtil.paletteIndexToRGB(LABEL_COLOR_PALETTE_NAME, index));
            }
        }
        return this.componentConfig.defaultFontColorHex;
    }

    // Renders the text onto a transparent canvas the size of the text area, one pixel per atlas texel.
    private renderTextToCanvas(): HTMLCanvasElement
    {
        const {width, height} = this.getTextAreaPixels();
        const ctx = getSharedCanvasContext();
        const canvas = ctx.canvas;
        if (canvas.width != width || canvas.height != height)
        {
            canvas.width = width; // Resizing clears the canvas, and resets the context's state too.
            canvas.height = height;
        }
        else
        {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, width, height);
        }

        const padding = PADDING * LABEL_PIXELS_PER_WORLD_UNIT;
        const usableWidth = width - 2 * padding;
        const usableHeight = height - 2 * padding;
        const {autoSize, fontSize} = LabelTextUtil.getFont(this.gameObject.params);

        ctx.font = `${MEASURING_FONT_SIZE_PX}px ${FONT_FAMILY}`;
        const layout = LabelTextLayoutUtil.layOut(LabelTextUtil.getText(this.gameObject.params),
            usableWidth, usableHeight, autoSize, fontSize,
            (str: string) => ctx.measureText(str).width / MEASURING_FONT_SIZE_PX);

        ctx.font = `${layout.fontSize}px ${FONT_FAMILY}`;
        // Only coverage reaches the atlas, so any opaque ink will do; emoji keep just their silhouette.
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Centred when it fits; otherwise from the top, so what doesn't fit is cut off at the bottom.
        const lineHeight = layout.fontSize * LabelTextLayoutUtil.lineSpacing;
        const top = padding + Math.max(0, 0.5 * (usableHeight - layout.lines.length * lineHeight));
        for (let i = 0; i < layout.lines.length; ++i)
        {
            const lineTop = top + i * lineHeight;
            if (lineTop >= height)
                break;
            ctx.fillText(layout.lines[i], 0.5 * width, lineTop + 0.5 * lineHeight);
        }
        return canvas;
    }
}

// Every object that can carry a label at once: each labeled category's room cap, counted once.
function getMaxLabelsPerRoom(): number
{
    const categories = new Set<string>();
    for (const config of ObjectTypeConfigMap.getAllConfigs())
    {
        if (config.components.spawnedByAny?.labelText)
            categories.add(config.category);
    }
    let maxLabels = 0;
    categories.forEach(category => maxLabels += ObjectCategoryConfigMap.getMaxCountPerRoom(category));
    return maxLabels;
}

// One canvas serves every label, since drawCanvasAtTexel copies it into the atlas before returning.
let sharedCanvasContext: CanvasRenderingContext2D | undefined;

function getSharedCanvasContext(): CanvasRenderingContext2D
{
    if (sharedCanvasContext == undefined)
    {
        const ctx = document.createElement("canvas").getContext("2d");
        if (ctx == null)
            throw new Error("LabelText :: Failed to acquire a 2D canvas context");
        sharedCanvasContext = ctx;
    }
    return sharedCanvasContext;
}

const spawnedLabelTexts: Set<LabelText> = new Set();

// Labels live only in a render target (GPU), so all of them redraw after a context restore (as
// CanvasGameObject does).
graphicsContextRestoredObservable.addListener("labelText", () => {
    spawnedLabelTexts.forEach((labelText) => labelText.redrawLostContents());
});
