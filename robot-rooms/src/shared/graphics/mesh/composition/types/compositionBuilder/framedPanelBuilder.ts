import { BACKWARD_DIR, INSTANCED_WOOD_MATERIAL_ID } from "../../../../../system/sharedConstants";
import Vec3 from "../../../../../math/types/vec3";
import { FRAMED_PANEL_BOARD_RELIEF,
    FRAMED_PANEL_GEOMETRY_ID } from "../compositionConstants/framedPanelCompositionConstants";
import FramedPanelCompositionParams from "../compositionParams/framedPanelCompositionParams";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";

export default abstract class FramedPanelBuilder extends InstancedMeshCompositionBuilder
{
    // Adds the moulded board over the whole footprint: the band in the frame color, the surface inside it
    // in the given color (see FramedPanelCompositionConstants). Faces local forward; the object's rotation
    // carries its facing.
    protected addBoard(surfaceColor: Vec3)
    {
        const params = this.params as FramedPanelCompositionParams;
        this.addPartRelativeToBase({
            geometryId: FRAMED_PANEL_GEOMETRY_ID,
            materialId: INSTANCED_WOOD_MATERIAL_ID,
            dir: BACKWARD_DIR,
            offset: {x: 0, y: 0, z: FRAMED_PANEL_BOARD_RELIEF},
            scale: {x: this.objectSize.x, y: this.objectSize.y, z: 1},
            color: surfaceColor,
            mouldingColor: params.colors.frame,
            mouldingThickness: params.mouldingThickness,
            mouldingIsConvex: params.mouldingIsConvex,
        });
    }
}
