import MaterialParams from "./materialParams";

export default class WireframeMaterialParams extends MaterialParams
{
    colorHex: string;

    constructor(colorHex: string)
    {
        super("Wireframe");

        this.colorHex = colorHex;
    }

    protected getDefaultMaterialId(): string
    {
        // "*" must be used to let us distinguish between materialType and its associated parameters.
        return `${super.getDefaultMaterialId()}*${this.colorHex}`;
    }
}