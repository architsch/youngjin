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

// The text an object carries, written onto a patch of the object itself rather than floated over it
// in the page. That is the whole reason this exists: a caption drawn in the browser's own layer sits
// on top of everything, so it would announce a door through the wall standing in front of it, and
// could only be hidden or shown whole. A label written into the world is hidden by exactly as much
// as stands in front of it, because it is part of the scene like anything else.
//
// Every label in a room is one instance of one mesh, and one cell of one texture, so a room full of
// them costs a single draw call — the same arrangement a room's canvases are drawn through, and the
// reason the number of them a room may hold is fixed.
//
// What the text says is always the object's own "Label" metadata. Where it goes, how big it is and
// what colour it is written in come from the object's type config, since those are facts about the
// object rather than about labelling.

// The margin left inside the patch, as a fraction of it. Lettering that runs to the very edge of a
// plate reads as lettering that did not fit.
const PADDING_FRACTION = 0.06;

// How many lines the text may be broken over, and how much room a line takes beyond the height of
// the letters themselves.
const MAX_LINES = 3;
const LINE_SPACING = 1.15;

// The font is measured once at this size and the size that fits is worked out from it, rather than
// being searched for by trying sizes: text measured at one size and scaled gives the same answer as
// text measured again at another.
const MEASURING_FONT_SIZE_PX = 64;

// A label names a way through a building, and the lettering signwriters have always cut into brass
// and painted onto glass for that is a roman serif. The fallbacks walk down to whatever serif the
// machine has, since the shape of the letters is what matters here rather than the exact face.
const FONT_FAMILY = "'Times New Roman', Times, serif";

export default class LabelText extends GameObjectComponent
{
    private static materialParams: InstancedTexturePackMaterialParams | undefined;
    private static instancedMeshId: string;

    private instancedMeshGraphics: InstancedMeshGraphics;
    private instanceId: number = -1;

    // What is currently written in this label's cell, and in what color, so that a metadata change
    // which left both alone costs nothing: the composition metadata a door carries changes far more
    // often than its name does, and both arrive here.
    private drawnText: string = "";
    private drawnColorHex: string = "";

    // The world transform the instance was last baked under, so a stationary object costs nothing
    // per frame. This is the test InstancedMeshComposer makes, for the same reason.
    private bakedWorldMatrix: THREE.Matrix4 = new THREE.Matrix4();

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);

        this.instancedMeshGraphics = gameObject.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("LabelText requires InstancedMeshGraphics component");

        if (LabelText.materialParams == undefined)
        {
            // The polygon-offset values are -1 for the same reason a canvas's are: the quad stands
            // flat against a surface, and must not z-fight with it.
            LabelText.materialParams = new InstancedTexturePackMaterialParams("label_text",
                LABEL_ATLAS_WIDTH, LABEL_ATLAS_HEIGHT,
                LABEL_ATLAS_CELL_WIDTH, LABEL_ATLAS_CELL_HEIGHT,
                "dynamicEmpty", -1, -1,
                true /* see-through around the lettering */,
                "linear" /* a glyph's edges are its legibility (see TextureFilterType) */);
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

    // Writes out whatever the object is currently called. A label with nothing written on it hands
    // its instance back rather than drawing an empty cell, so that a room of unnamed objects costs
    // nothing and leaves the pool to the ones that are named.
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
            // The room may hold more labels than the mesh has instances for, in which case this one
            // stays undrawn rather than taking the whole room's rendering down with it.
            const rentedInstanceId = this.instancedMeshGraphics.rentInstanceFromPool(
                LabelText.instancedMeshId);
            if (rentedInstanceId == undefined)
                return;
            this.instanceId = rentedInstanceId;
            this.drawnText = "";
            this.drawnColorHex = "";
            this.instancedMeshGraphics.updateInstanceTextureUV(LabelText.instancedMeshId,
                this.instanceId, this.instanceId);
            this.updateInstanceTransform();
        }

        if (this.drawnText === text && this.drawnColorHex === colorHex)
            return;
        this.instancedMeshGraphics.drawCanvasAtIndex(LabelText.instancedMeshId, this.instanceId,
            this.renderTextToCanvas(text, colorHex));
        this.drawnText = text;
        this.drawnColorHex = colorHex;
    }

    // Forgets what the cell is holding, without touching it. For the one case where the cell's
    // contents were lost rather than replaced (see the context-restore listener below).
    forgetWhatWasDrawn(): void
    {
        this.drawnText = "";
        this.drawnColorHex = "";
    }

    // What the lettering is written in: the object's own choice where it has made one, and otherwise
    // the color its type was given. A door's plate is a color its owner picked too, so the ink on it
    // has to be able to follow — but a door nobody has thought about the ink on should still read.
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

    // Visits the instance this label is drawn from, if it has one. Whatever acts on an object as a
    // whole — taking it out of the orbit camera's way, above all — has to reach this as well as the
    // parts the object is composed of, or a door goes out of sight and leaves its name hanging in
    // the air (see OrbitOcclusionHider).
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

    // Lays the text out over the patch the object set aside for it, and hands back a canvas holding
    // it against nothing.
    //
    // The layout is done in the patch's own world units and scaled onto the cell at the end, rather
    // than in the cell's pixels. A cell is one fixed shape and a patch is whatever shape the object
    // gave it, so laying out in pixels would come out stretched by however far the two disagree.
    // This way the letters are the shape they were drawn as, and all a mismatch costs is an uneven
    // share of the cell's pixels between the two axes.
    private renderTextToCanvas(text: string, fontColorHex: string): HTMLCanvasElement
    {
        const {size} = this.componentConfig;

        const canvas = document.createElement("canvas");
        canvas.width = LABEL_ATLAS_CELL_WIDTH;
        canvas.height = LABEL_ATLAS_CELL_HEIGHT;
        const ctx = canvas.getContext("2d");
        if (ctx == null)
            throw new Error("LabelText :: Failed to acquire a 2D canvas context");

        // Everything below is in the patch's world units, with the origin at its centre.
        ctx.setTransform(canvas.width / size.x, 0, 0, canvas.height / size.y,
            0.5 * canvas.width, 0.5 * canvas.height);

        const usableWidth = size.x * (1 - 2 * PADDING_FRACTION);
        const usableHeight = size.y * (1 - 2 * PADDING_FRACTION);
        const {lines, fontSize} = layOutText(ctx, text, usableWidth, usableHeight);

        ctx.font = `${fontSize}px ${FONT_FAMILY}`;
        ctx.fillStyle = fontColorHex;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const lineHeight = fontSize * LINE_SPACING;
        const firstLineY = -0.5 * (lines.length - 1) * lineHeight;
        for (let i = 0; i < lines.length; ++i)
            ctx.fillText(lines[i], 0, firstLineY + i * lineHeight);

        return canvas;
    }
}

// How to break the text and how large to write it, chosen together: they are one question, since
// every extra line buys width at the cost of height and only the two together decide how big the
// letters end up. So each line count the words allow is tried, and the one that lets the text be
// written largest wins.
//
// Words are never broken. A name split down the middle is harder to read than the same name written
// smaller, and a plate is read at a glance or not at all.
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

        // As wide as the widest line allows, and as tall as the stack of lines allows — whichever
        // of the two is the tighter constraint is the size the text can actually be written at.
        const fontSize = Math.min(
            (widestLine > 0) ? (MEASURING_FONT_SIZE_PX * usableWidth / widestLine) : usableHeight,
            usableHeight / (lineCount * LINE_SPACING));
        if (best == undefined || fontSize > best.fontSize)
            best = {lines, fontSize};
    }
    return best!;
}

// Shares the words out over the given number of lines as evenly as whole words allow. Filling each
// line to the brim instead would leave the last one holding a single word, which on a plate reads
// as a mistake rather than as a line break.
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

// Every label currently in the room, so that they can all be written out again together when their
// texture is taken away and handed back (see below).
const spawnedLabelTexts: Set<LabelText> = new Set();

// A label's lettering is drawn into a render target, which is to say straight onto the GPU with no
// copy kept anywhere else. A drawing context the browser took away and gave back therefore comes
// back holding an empty one, so every label in the room writes itself out again — the same work it
// does when it spawns. CanvasGameObject is restored for exactly the same reason.
graphicsContextRestoredObservable.addListener("labelText", () => {
    spawnedLabelTexts.forEach((labelText) => {
        labelText.forgetWhatWasDrawn();
        labelText.redraw();
    });
});
