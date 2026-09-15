import { BACKWARD_DIR } from "../../../../../system/sharedConstants";
import { CANVAS_BOARD_RELIEF, CANVAS_FOOTPRINT_HEIGHT,
    CANVAS_FOOTPRINT_WIDTH } from "../compositionConstants/canvasCompositionConstants";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";

export default class CanvasCompositionBuilder extends InstancedMeshCompositionBuilder
{
    run(): InstancedMeshCompositionBuilder
    {
        throw new Error("CanvasCompositionBuilder :: Method 'run' must be overriden by its child class.");
    }

    // Adds the moulded board across the footprint, finished with the canvas's own wood inputs: the band
    // in the frame color, the surface inside it in the inner color (see CanvasCompositionConstants).
    protected addBoard()
    {
        this.addPartRelativeToBase({
            instancedMeshId: this.params.ids.instancedMeshId_square,
            // Faces local forward; the object's rotation carries the wall facing.
            dir: BACKWARD_DIR,
            offset: {x: 0, y: 0, z: CANVAS_BOARD_RELIEF},
            scale: {x: CANVAS_FOOTPRINT_WIDTH, y: CANVAS_FOOTPRINT_HEIGHT, z: 1},
            color: this.params.colors.inner,
            mouldingColor: this.params.colors.frame,
            mouldingThickness: this.params.mouldingThickness,
            mouldingIsConvex: this.params.mouldingIsConvex,
        });
    }
}
