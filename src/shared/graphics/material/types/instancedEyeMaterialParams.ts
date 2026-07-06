import MaterialParams from "./materialParams";

export default class InstancedEyeMaterialParams extends MaterialParams
{
    constructor()
    {
        super("InstancedEye");
    }

    protected getDefaultMaterialId(): string
    {
        return super.getDefaultMaterialId();
    }
}
