import MaterialParams from "./materialParams";

export default class InstancedTexturePackMaterialParams extends MaterialParams
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
        super("InstancedTexturePack");

        this.texturePath = texturePath;
        this.textureWidth = textureWidth;
        this.textureHeight = textureHeight;
        this.textureGridCellWidth = textureGridCellWidth;
        this.textureGridCellHeight = textureGridCellHeight;
        this.textureLoadType = textureLoadType;
        this.polygonOffsetFactor = polygonOffsetFactor;
        this.polygonOffsetUnits = polygonOffsetUnits;
    }

    protected getDefaultMaterialId(): string
    {
        // "*" must be used to let us distinguish between materialType and its associated parameters.
        return `${super.getDefaultMaterialId()}*${this.texturePath}`;
    }
}

type TextureLoadType = "staticImageFromPath" | "dynamicEmpty";