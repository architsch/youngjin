import MaterialParams from "./materialParams";

export default class LineBasicMaterialParams extends MaterialParams
{
    colorHex: string;

    constructor(colorHex: string)
    {
        super("LineBasic");

        this.colorHex = colorHex;
    }

    protected getDefaultMaterialId(): string
    {
        // "*" must be used to let us distinguish between materialType and its associated parameters.
        return `${super.getDefaultMaterialId()}*${this.colorHex}`;
    }
}
