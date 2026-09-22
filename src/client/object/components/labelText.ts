import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import GameObject from "../types/gameObject";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import InstancedTexturePackMaterialParams from "../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import MeshDataUtil from "../../../shared/graphics/mesh/util/meshDataUtil";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { BACKWARD_DIR, LABEL_ATLAS_CELL_HEIGHT, LABEL_ATLAS_CELL_WIDTH, LABEL_ATLAS_HEIGHT,
    LABEL_ATLAS_WIDTH, LABEL_COLOR_PALETTE_NAME, LABEL_GEOMETRY_ID,
    MAX_LABELS_PER_ROOM } from "../../../shared/system/sharedConstants";
import ColorUtil from "../../../shared/math/util/colorUtil";
import { graphicsContextRestoredObservable } from "../../system/clientObservables";

// An object's "Label" text, drawn onto a patch of the object in the scene (not an HTML overlay), so
// walls occlude it. All labels in a room share one mesh and one texture (one draw call), which is why
// the label count is capped. Placement, size and color come from the object's type config.

// Inner margin as a fraction of the patch.
const PADDING_FRACTION = 0.06;

const MAX_LINES = 3;
const LINE_SPACING = 1.15;

// Measured once at this size and scaled, since text metrics scale linearly.
const MEASURING_FONT_SIZE_PX = 64;

// Roman serif, as on brass plates and signwriting.
const FONT_FAMILY = "'Times New Roman', Times, serif";

export default class LabelText extends GameObjectComponent
{
    private static materialParams: InstancedTexturePackMaterialParams | undefined;
    private static instancedMeshId: string;

    private instancedMeshGraphics: InstancedMeshGraphics;
    private instanceId: number = -1;

    // Skip redraws when metadata changes don't affect the text or color (composition changes are
    // far more frequent). A color change only recolors the instance.
    private drawnText: string = "";
    private appliedColorHex: string = "";

    // Skips per-frame re-baking while stationary (as InstancedMeshComposer does).
    private bakedWorldMatrix: THREE.Matrix4 = new THREE.Matrix4();

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
                LABEL_ATLAS_WIDTH, LABEL_ATLAS_HEIGHT,
                LABEL_ATLAS_CELL_WIDTH, LABEL_ATLAS_CELL_HEIGHT,
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
            LabelText.materialParams!, MAX_LABELS_PER_ROOM, true);
        spawnedLabelTexts.add(this);
        this.redraw();
    }

    async onDespawn(): Promise<void>
    {
        spawnedLabelTexts.delete(this);
        this.releaseInstance();
    }

    update(deltaTime: number): void
    {
        if (this.instanceId !== -1 && !this.transformIsInSync())
            this.updateInstanceTransform();
    }

    onSetMetadata(key: ObjectMetadataKey, value: string): void
    {
        if (key === ObjectMetadataKeyEnumMap.Label || key === ObjectMetadataKeyEnumMap.LabelColor)
            this.redraw();
    }

    // An empty label returns its instance instead of drawing an empty cell.
    redraw(): void
    {
        const text = this.gameObject.params.metadata[ObjectMetadataKeyEnumMap.Label]?.str ?? "";
        if (text.length === 0)
        {
            this.releaseInstance();
            return;
        }
        const colorHex = this.getFontColorHex();

        if (this.instanceId === -1)
        {
            // The pool may be exhausted; the label then stays undrawn.
            const rentedInstanceId = this.instancedMeshGraphics.rentInstanceFromPool(
                LabelText.instancedMeshId);
            if (rentedInstanceId == undefined)
                return;
            this.instanceId = rentedInstanceId;
            this.drawnText = "";
            this.appliedColorHex = "";
            this.instancedMeshGraphics.updateInstanceTextureUV(LabelText.instancedMeshId,
                this.instanceId, this.instanceId);
            this.updateInstanceTransform();
        }

        if (this.appliedColorHex !== colorHex)
        {
            const rgb = ColorUtil.hexToRGB(colorHex);
            this.instancedMeshGraphics.updateInstanceColor(LabelText.instancedMeshId, this.instanceId,
                rgb.x, rgb.y, rgb.z);
            this.appliedColorHex = colorHex;
        }
        if (this.drawnText !== text)
        {
            this.instancedMeshGraphics.drawCanvasAtIndex(LabelText.instancedMeshId, this.instanceId,
                this.renderTextToCanvas(text));
            this.drawnText = text;
        }
    }

    // For when the cell's contents were lost, not replaced (context restore, below).
    forgetWhatWasDrawn(): void
    {
        this.drawnText = "";
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

    // So whole-object actions (e.g. occlusion hiding) also reach the label (see OrbitOcclusionHider).
    forEachInstance(visit: (instancedMeshId: string, instanceId: number) => void)
    {
        if (this.instanceId !== -1)
            visit(LabelText.instancedMeshId, this.instanceId);
    }

    private releaseInstance(): void
    {
        this.drawnText = "";
        if (this.instanceId === -1)
            return;
        this.instancedMeshGraphics.returnInstanceToPool(LabelText.instancedMeshId, this.instanceId);
        this.instanceId = -1;
    }

    private updateInstanceTransform(): void
    {
        const {localOffset, size} = this.componentConfig;
        this.instancedMeshGraphics.updateInstanceTransform(
            LabelText.instancedMeshId, this.instanceId,
            localOffset.x, localOffset.y, localOffset.z,
            BACKWARD_DIR.x, BACKWARD_DIR.y, BACKWARD_DIR.z,
            size.x, size.y, 1);

        this.gameObject.obj.updateMatrixWorld();
        this.bakedWorldMatrix.copy(this.gameObject.visualObj.matrixWorld);
    }

    private transformIsInSync(): boolean
    {
        this.gameObject.obj.updateMatrixWorld(); // Recurses to visualObj, so the compared matrix is current.
        return this.gameObject.visualObj.matrixWorld.equals(this.bakedWorldMatrix);
    }

    // Renders the text onto a transparent canvas. Laid out in the patch's world units and scaled to
    // the cell at the end, so letters aren't stretched when the shapes differ.
    private renderTextToCanvas(text: string): HTMLCanvasElement
    {
        const {size} = this.componentConfig;

        const ctx = getSharedCanvasContext();
        const canvas = ctx.canvas;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Everything below is in the patch's world units, with the origin at its centre.
        ctx.setTransform(canvas.width / size.x, 0, 0, canvas.height / size.y,
            0.5 * canvas.width, 0.5 * canvas.height);

        const usableWidth = size.x * (1 - 2 * PADDING_FRACTION);
        const usableHeight = size.y * (1 - 2 * PADDING_FRACTION);
        const {lines, fontSize} = layOutText(ctx, text, usableWidth, usableHeight);

        ctx.font = `${fontSize}px ${FONT_FAMILY}`;
        // Only coverage reaches the atlas, so any opaque ink will do; emoji keep just their silhouette.
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const lineHeight = fontSize * LINE_SPACING;
        const firstLineY = -0.5 * (lines.length - 1) * lineHeight;
        for (let i = 0; i < lines.length; ++i)
            ctx.fillText(lines[i], 0, firstLineY + i * lineHeight);

        return canvas;
    }
}

// Chooses the line count and font size together, picking the line count that allows the largest text.
// Words are never split.
function layOutText(ctx: CanvasRenderingContext2D, text: string,
    usableWidth: number, usableHeight: number): {lines: string[], fontSize: number}
{
    ctx.font = `${MEASURING_FONT_SIZE_PX}px ${FONT_FAMILY}`;

    const words = text.split(/\s+/).filter(word => word.length > 0);
    if (words.length === 0)
        return {lines: [text], fontSize: usableHeight};

    let best: {lines: string[], fontSize: number} | undefined;
    for (let lineCount = 1; lineCount <= Math.min(MAX_LINES, words.length); ++lineCount)
    {
        const lines = splitIntoLines(words, lineCount);
        const widestLine = lines.reduce((widest, line) =>
            Math.max(widest, ctx.measureText(line).width), 0);

        // Limited by whichever of width and height is tighter.
        const fontSize = Math.min(
            (widestLine > 0) ? (MEASURING_FONT_SIZE_PX * usableWidth / widestLine) : usableHeight,
            usableHeight / (lineCount * LINE_SPACING));
        if (best == undefined || fontSize > best.fontSize)
            best = {lines, fontSize};
    }
    return best!;
}

// Balances words across lines (greedy filling would strand one word on the last line).
function splitIntoLines(words: string[], lineCount: number): string[]
{
    const lines: string[] = [];
    let wordIndex = 0;
    for (let i = 0; i < lineCount; ++i)
    {
        const wordsLeft = words.length - wordIndex;
        const linesLeft = lineCount - i;
        const wordsOnThisLine = Math.ceil(wordsLeft / linesLeft);
        lines.push(words.slice(wordIndex, wordIndex + wordsOnThisLine).join(" "));
        wordIndex += wordsOnThisLine;
    }
    return lines;
}

// One canvas serves every label, since drawCanvasAtIndex copies it into the atlas before returning.
let sharedCanvasContext: CanvasRenderingContext2D | undefined;

function getSharedCanvasContext(): CanvasRenderingContext2D
{
    if (sharedCanvasContext == undefined)
    {
        const canvas = document.createElement("canvas");
        canvas.width = LABEL_ATLAS_CELL_WIDTH;
        canvas.height = LABEL_ATLAS_CELL_HEIGHT;
        const ctx = canvas.getContext("2d");
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
    spawnedLabelTexts.forEach((labelText) => {
        labelText.forgetWhatWasDrawn();
        labelText.redraw();
    });
});
