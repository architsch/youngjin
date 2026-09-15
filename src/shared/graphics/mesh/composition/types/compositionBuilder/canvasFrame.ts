import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import CanvasCompositionBuilder from "./canvasCompositionBuilder";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";

// Single moulded board: the frame and the backing the picture hangs on are one quad, and a canvas without
// a frame has neither.
class CanvasFrame_0 extends CanvasCompositionBuilder
{
    override run(): InstancedMeshCompositionBuilder
    {
        if (this.params.framed)
            this.addBoard();
        return this;
    }
}
InstancedMeshCompositionBuilderMap["CanvasFrame_0"] =
    (params, parts) => new CanvasFrame_0(params, parts);
