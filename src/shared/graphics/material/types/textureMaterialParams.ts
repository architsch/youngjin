import MaterialParams from "./materialParams";

export default class TextureMaterialParams extends MaterialParams
{
    texturePath: string;
    polygonOffsetFactor?: number;
    polygonOffsetUnits?: number;

    constructor(texturePath: string, polygonOffsetFactor?: number, polygonOffsetUnits?: number)
    {
        super("Texture");

        this.texturePath = texturePath;
        this.polygonOffsetFactor = polygonOffsetFactor;
        this.polygonOffsetUnits = polygonOffsetUnits;
    }

    protected getDefaultMaterialId(): string
    {
        // "*" must be used to let us distinguish between materialType and its associated parameters.
        return `${super.getDefaultMaterialId()}*${this.texturePath}`;
    }
}