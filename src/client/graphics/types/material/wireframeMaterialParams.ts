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
        return `${super.getDefaultMaterialId()}-${this.colorHex}`;
    }
}