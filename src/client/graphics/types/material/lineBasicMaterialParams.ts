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
        return `${super.getDefaultMaterialId()}-${this.colorHex}`;
    }
}
