import MaterialParams from "./materialParams";

export default class TexturePackMaterialParams extends MaterialParams
{
    texturePath: string;
    textureWidth: number;
    textureHeight: number;
    textureGridCellWidth: number;
    textureGridCellHeight: number;
    textureLoadType: TextureLoadType;
    polygonOffsetFactor?: number;
    polygonOffsetUnits?: number;

    constructor(texturePath: string, textureWidth: number, textureHeight: number,
        textureGridCellWidth: number, textureGridCellHeight: number,
        textureLoadType: TextureLoadType,
        polygonOffsetFactor?: number, polygonOffsetUnits?: number)
    {
        super("TexturePack");

        this.texturePath = texturePath;
        this.textureWidth = textureWidth;
        this.textureHeight = textureHeight;
        this.textureGridCellWidth = textureGridCellWidth;
        this.textureGridCellHeight = textureGridCellHeight;
        this.textureLoadType = textureLoadType;
        this.polygonOffsetFactor = polygonOffsetFactor;
        this.polygonOffsetUnits = polygonOffsetUnits;
    }

    getMaterialId(): string
    {
        return `${super.getMaterialId()}-${this.texturePath}`;
    }
}

type TextureLoadType = "staticImageFromPath" | "dynamicEmpty";