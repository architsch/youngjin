import MaterialParams from "./materialParams";

// The canvas context type is left untyped here, since shared code has no DOM types.

// A flat, unlit, transparent, double-sided sprite drawn onto a canvas at runtime; always renders on top.
export default class SpriteMaterialParams extends MaterialParams
{
    textureId: string;
    textureWidth: number;
    textureHeight: number;
    draw: (ctx: any/*CanvasRenderingContext2D*/, width: number, height: number) => void;
    opacity: number;

    constructor(textureId: string, textureWidth: number, textureHeight: number,
        draw: (ctx: any/*CanvasRenderingContext2D*/, width: number, height: number) => void,
        opacity: number = 1)
    {
        super("Sprite");

        this.textureId = textureId;
        this.textureWidth = textureWidth;
        this.textureHeight = textureHeight;
        this.draw = draw;
        this.opacity = opacity;
    }

    protected getDefaultMaterialId(): string
    {
        // "*" must be used to let us distinguish between materialType and its associated parameters.
        return `${super.getDefaultMaterialId()}*${this.textureId}*${this.opacity}`;
    }
}
