import PetCompositionConstants from "../../../shared/graphics/mesh/composition/types/compositionConstants/petCompositionConstants";

// A plate is drawn this large, in texels, and the word over a battery indicator within this much of one.
export const PET_PLATE_WIDTH = 256;
export const PET_PLATE_HEIGHT = 144;
export const PET_POWER_LABEL_WIDTH = 128;
export const PET_POWER_LABEL_HEIGHT = 40;
// The model every pet is, printed on it so that people see an AI plays it.
export const PET_MODEL_NAME = "AI26";
export const PET_POWER_LABEL = "Power";

// The game's own font (see --font-mono in input.css), from which the browser falls back for a script it lacks.
const FONT_FAMILY = "'Lucida Console', 'Lucida Sans Typewriter', Monaco, Consolas, monospace";
const MARGIN = 6;
const MODEL_FONT_SIZE = 40;
// The box the name goes in, where the pet's label lies under it (see PetCompositionConstants.nameBox).
const NAME_BOX = PetCompositionConstants.nameBox;
const BOX_LEFT = Math.round(NAME_BOX.left * PET_PLATE_WIDTH);
const BOX_RIGHT = Math.round(NAME_BOX.right * PET_PLATE_WIDTH);
const BOX_TOP = Math.round(NAME_BOX.top * PET_PLATE_HEIGHT);
const BOX_BOTTOM = Math.round(NAME_BOX.bottom * PET_PLATE_HEIGHT);
// Where a plate is parted, from its top (see PetNamePlate): in the blank between its model and barcode and the box.
export const PET_PLATE_SPLIT_ROW = BOX_TOP - 4;
const BOX_BORDER = 4;
const NAME_MAX_FONT_SIZE = 44;
const NAME_MIN_FONT_SIZE = 14;
const POWER_FONT_SIZE = 34;

let sharedContext: CanvasRenderingContext2D | undefined;

// What is printed on a pet (see PetNamePlate), as coverage alone: whoever shows it gives it its ink.
const PetPlateDrawUtil =
{
    // The plate under a pet's face, and on its back: its model, a barcode of its own (seed: what tells it from other
    // pets), and its name in a box, as large as the box lets it be. The canvas is shared, so it is to be copied before
    // the next draw.
    drawPlate: (name: string, seed: string): HTMLCanvasElement =>
    {
        const ctx = clear(PET_PLATE_WIDTH, PET_PLATE_HEIGHT);
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";

        ctx.font = `bold ${MODEL_FONT_SIZE}px ${FONT_FAMILY}`;
        ctx.textAlign = "left";
        ctx.fillText(PET_MODEL_NAME, MARGIN, 0.5 * BOX_TOP + 2);
        const barcodeLeft = MARGIN + Math.ceil(ctx.measureText(PET_MODEL_NAME).width) + 12;
        drawBarcode(ctx, seed, barcodeLeft, 10, PET_PLATE_WIDTH - MARGIN - barcodeLeft, BOX_TOP - 20);

        const boxWidth = BOX_RIGHT - BOX_LEFT;
        const boxHeight = BOX_BOTTOM - BOX_TOP;
        ctx.fillRect(BOX_LEFT, BOX_TOP, boxWidth, boxHeight);
        ctx.clearRect(BOX_LEFT + BOX_BORDER, BOX_TOP + BOX_BORDER, boxWidth - 2 * BOX_BORDER, boxHeight - 2 * BOX_BORDER);

        const nameWidth = boxWidth - 2 * (BOX_BORDER + 6);
        let fontSize = NAME_MAX_FONT_SIZE;
        ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
        while (fontSize > NAME_MIN_FONT_SIZE && ctx.measureText(name).width > nameWidth)
            ctx.font = `bold ${--fontSize}px ${FONT_FAMILY}`;
        ctx.textAlign = "center";
        ctx.fillText(name, BOX_LEFT + 0.5 * boxWidth, BOX_TOP + 0.5 * boxHeight + 2, nameWidth);
        return ctx.canvas;
    },
    // The word over a battery indicator.
    drawPowerLabel: (): HTMLCanvasElement =>
    {
        const ctx = clear(PET_POWER_LABEL_WIDTH, PET_POWER_LABEL_HEIGHT);
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.font = `bold ${POWER_FONT_SIZE}px ${FONT_FAMILY}`;
        ctx.fillText(PET_POWER_LABEL, 0.5 * PET_POWER_LABEL_WIDTH, 0.5 * PET_POWER_LABEL_HEIGHT + 2, PET_POWER_LABEL_WIDTH - 4);
        return ctx.canvas;
    },
}

function clear(width: number, height: number): CanvasRenderingContext2D
{
    if (sharedContext == undefined)
    {
        const ctx = document.createElement("canvas").getContext("2d");
        if (ctx == null)
            throw new Error("PetPlateDrawUtil :: Failed to acquire a 2D canvas context");
        sharedContext = ctx;
    }
    // Resizing clears the canvas, and resets the context's state too.
    sharedContext.canvas.width = width;
    sharedContext.canvas.height = height;
    return sharedContext;
}

// Bars and gaps a few texels wide each, as the seed has them.
function drawBarcode(ctx: CanvasRenderingContext2D, seed: string, left: number, top: number, width: number,
    height: number): void
{
    let hash = 2166136261;
    for (let i = 0; i < seed.length; ++i)
        hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
    const next = () => {
        hash = Math.imul(hash ^ (hash >>> 15), 2246822519) + 0x9e3779b9 | 0;
        return (hash >>> 8) & 0xff;
    };
    let x = left;
    while (x < left + width)
    {
        const bar = Math.min(2 * (1 + next() % 3), left + width - x);
        ctx.fillRect(x, top, bar, height);
        x += bar + 2 * (1 + next() % 2);
    }
}

export default PetPlateDrawUtil;
