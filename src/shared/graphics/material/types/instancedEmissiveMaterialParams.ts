import MaterialParams from "./materialParams";

// The material a light-emitting part of an object is finished in: it is drawn at the full strength
// of its own color, regardless of what is falling on it, which is what being a source of light
// rather than a receiver of it looks like.
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
