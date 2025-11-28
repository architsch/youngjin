import MaterialParams from "./materialParams";

export default class TexturePackMaterialParams extends MaterialParams
{
    textureId: string;
    textureWidth: number;
    textureHeight: number;
    textureGridCellWidth: number;
    textureGridCellHeight: number;
    textureLoadType: TextureLoadType;

    constructor(textureId: string, textureWidth: number, textureHeight: number,
        textureGridCellWidth: number, textureGridCellHeight: number,
        textureLoadType: TextureLoadType)
    {
        super("TexturePack");

        this.textureId = textureId;
        this.textureWidth = textureWidth;
        this.textureHeight = textureHeight;
        this.textureGridCellWidth = textureGridCellWidth;
        this.textureGridCellHeight = textureGridCellHeight;
        this.textureLoadType = textureLoadType;
    }

    getMaterialId(): string
    {
        return `${super.getMaterialId()}-${this.textureId}`;
    }
}

type TextureLoadType = "staticImageFromURL" | "dynamicEmpty";