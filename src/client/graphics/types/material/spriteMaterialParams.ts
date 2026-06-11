import MaterialParams from "./materialParams";

// Describes a flat, unlit "sprite" material whose color image is drawn onto a canvas at runtime.
// The resulting material is transparent and double-sided, and it skips the depth test so the
// sprite always renders on top of scene geometry.
export default class SpriteMaterialParams extends MaterialParams
{
    textureId: string;
    textureWidth: number;
    textureHeight: number;
    draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
    opacity: number;

    constructor(textureId: string, textureWidth: number, textureHeight: number,
        draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
        opacity: number = 1)
    {
        super("Sprite");

        this.textureId = textureId;
        this.textureWidth = textureWidth;
        this.textureHeight = textureHeight;
        this.draw = draw;
        this.opacity = opacity;
    }

    getMaterialId(): string
    {
        return `${super.getMaterialId()}-${this.textureId}-${this.opacity}`;
    }
}
