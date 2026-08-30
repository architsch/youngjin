import MaterialParams from "./materialParams";
import TextureFilterType from "./textureFilterType";

export default class InstancedTexturePackMaterialParams extends MaterialParams
{
    texturePath: string;
    textureWidth: number;
    textureHeight: number;
    textureGridCellWidth: number;
    textureGridCellHeight: number;
    textureLoadType: TextureLoadType;
    // Whether what the texture holds is meant to be partly see-through — lettering written straight
    // onto an object, where everything around the glyphs has to show the object behind them. A
    // texture pack of pictures covers its quad and needs none of this.
    transparent: boolean;
    // How the texture is sampled. Kept apart from transparency, which it tends to accompany without
    // following from: what a texture holds decides how it should be filtered, and a see-through
    // texture of pictures would want its cells left crisp like any other.
    filterType: TextureFilterType;
    polygonOffsetFactor?: number;
    polygonOffsetUnits?: number;

    constructor(texturePath: string, textureWidth: number, textureHeight: number,
        textureGridCellWidth: number, textureGridCellHeight: number,
        textureLoadType: TextureLoadType,
        polygonOffsetFactor?: number, polygonOffsetUnits?: number,
        transparent: boolean = false, filterType: TextureFilterType = "nearest")
    {
        super("InstancedTexturePack");

        this.texturePath = texturePath;
        this.textureWidth = textureWidth;
        this.textureHeight = textureHeight;
        this.textureGridCellWidth = textureGridCellWidth;
        this.textureGridCellHeight = textureGridCellHeight;
        this.textureLoadType = textureLoadType;
        this.transparent = transparent;
        this.filterType = filterType;
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