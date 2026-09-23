import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import FramedPanelCompositionParams from "../compositionParams/framedPanelCompositionParams";
import FramedPanelBuilder from "./framedPanelBuilder";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";

// The board alone, its inside in the inner color; the object draws what it frames (a canvas's picture, a
// label's text). Without a frame there is no board at all.
class PanelBoard_0 extends FramedPanelBuilder
{
    override run(): InstancedMeshCompositionBuilder
    {
        const params = this.params as FramedPanelCompositionParams;
        if (params.framed)
            this.addBoard(params.colors.inner ?? params.colors.frame);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["PanelBoard_0"] =
    (params, parts, objectSize) => new PanelBoard_0(params, parts, objectSize);
