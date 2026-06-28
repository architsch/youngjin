import MaterialParams from "./materialParams";

export default class InstancedColorMaterialParams extends MaterialParams
{
    constructor()
    {
        super("InstancedColor");
    }

    protected getDefaultMaterialId(): string
    {
        return super.getDefaultMaterialId();
    }
}
