import MaterialParams from "./materialParams";

// Note: The "CanvasRenderingContext2D" type is not explicitly specified in this file,
// since it is part of the "shared" codebase which does not include client-side libraries.

// Describes a flat, unlit "sprite" material whose color image is drawn onto a canvas at runtime.
// The resulting material is transparent and double-sided, and it skips the depth test so the
// sprite always renders on top of scene geometry.
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
