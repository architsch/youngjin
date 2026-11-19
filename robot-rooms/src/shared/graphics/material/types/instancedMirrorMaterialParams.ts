import MaterialParams from "./materialParams";

// A mirror's glass: the room reflected, which is lit and fogged as it is drawn (see MirrorReflectionUtil), under a
// surface lit and fogged as any other (see mirrorShader).
export default class InstancedMirrorMaterialParams extends MaterialParams
{
    constructor()
    {
        super("InstancedMirror");
    }
}
