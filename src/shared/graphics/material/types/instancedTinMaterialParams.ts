import MaterialParams from "./materialParams";

export default class InstancedTinMaterialParams extends MaterialParams
{
    constructor()
    {
        super("InstancedTin");
    }

    protected getDefaultMaterialId(): string
    {
        return super.getDefaultMaterialId();
    }
}
