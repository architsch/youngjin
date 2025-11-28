import MaterialParams from "./materialParams";

export default class WireframeMaterialParams extends MaterialParams
{
    colorHex: string;

    constructor(colorHex: string)
    {
        super("Wireframe");

        this.colorHex = colorHex;
    }

    getMaterialId(): string
    {
        return `${super.getMaterialId()}-${this.colorHex}`;
    }
}