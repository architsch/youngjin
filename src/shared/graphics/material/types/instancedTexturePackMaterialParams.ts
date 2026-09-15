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
    // Partly see-through content (e.g. lettering on an object).
    transparent: boolean;
    // Sampling filter, independent of transparency.
    filterType: TextureFilterType;
    polygonOffsetFactor?: number;
    polygonOffsetUnits?: number;
    // Outline color "#rrggbb", set after construction. Enables the per-instance outline attribute
    // and shader code (see InstancedMeshBinding.updateInstanceOutline); undefined costs nothing.
    outlineColorHex: string | undefined;
    // Set after construction: texels with low alpha are discarded instead of blended, so the quad keeps
    // opaque depth and sorting while parts of its cell stay see-through (e.g. around a letterboxed picture).
    alphaCutout: boolean;

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
        this.outlineColorHex = undefined;
        this.alphaCutout = false;
    }

    protected getDefaultMaterialId(): string
    {
        // "*" must be used to let us distinguish between materialType and its associated parameters.
        return `${super.getDefaultMaterialId()}*${this.texturePath}`;
    }
}

type TextureLoadType = "staticImageFromPath" | "dynamicEmpty";