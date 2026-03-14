import MaterialParams from "./materialParams";

export default class LineBasicMaterialParams extends MaterialParams
{
    colorHex: string;

    constructor(colorHex: string)
    {
        super("LineBasic");

        this.colorHex = colorHex;
    }

    getMaterialId(): string
    {
        return `${super.getMaterialId()}-${this.colorHex}`;
    }
}
