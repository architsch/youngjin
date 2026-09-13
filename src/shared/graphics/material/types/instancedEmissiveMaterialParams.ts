import MaterialParams from "./materialParams";

// Unlit material for light-emitting parts: drawn at full color regardless of lighting.
export default class InstancedEmissiveMaterialParams extends MaterialParams
{
    constructor()
    {
        super("InstancedEmissive");
    }

    protected getDefaultMaterialId(): string
    {
        return super.getDefaultMaterialId();
    }
}
