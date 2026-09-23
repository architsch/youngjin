import { BACKWARD_DIR, INSTANCED_WOOD_MATERIAL_ID } from "../../../../../system/sharedConstants";
import CanvasCompositionConstants, { CANVAS_BOARD_RELIEF,
    CANVAS_GEOMETRY_ID } from "../compositionConstants/canvasCompositionConstants";
import CanvasCompositionParams from "../compositionParams/canvasCompositionParams";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";

export default class CanvasCompositionBuilder extends InstancedMeshCompositionBuilder
{
    run(): InstancedMeshCompositionBuilder
    {
        throw new Error("CanvasCompositionBuilder :: Method 'run' must be overriden by its child class.");
    }

    // Adds the moulded board a margin inside the footprint, finished with the canvas's own wood inputs:
    // the band in the frame color, the surface inside it in the inner color (see
    // CanvasCompositionConstants). The board follows whatever the canvas has been sized to; the band keeps
    // its width, because the wood material measures it in world units (see the "InstancedWood" shader).
    protected addBoard()
    {
        const size = CanvasCompositionConstants.getDrawnSize(this.params as CanvasCompositionParams,
            this.objectSize);
        this.addPartRelativeToBase({
            geometryId: CANVAS_GEOMETRY_ID,
            materialId: INSTANCED_WOOD_MATERIAL_ID,
            // Faces local forward; the object's rotation carries the wall facing.
            dir: BACKWARD_DIR,
            offset: {x: 0, y: 0, z: CANVAS_BOARD_RELIEF},
            scale: size,
            color: this.params.colors.inner,
            mouldingColor: this.params.colors.frame,
            mouldingThickness: this.params.mouldingThickness,
            mouldingIsConvex: this.params.mouldingIsConvex,
        });
    }
}
