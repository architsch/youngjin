import { BACKWARD_DIR, INSTANCED_EMISSIVE_MATERIAL_ID } from "../../../../../system/sharedConstants";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import FramedPanelCompositionConstants, { FRAMED_PANEL_BOARD_RELIEF, FRAMED_PANEL_CONTENT_LIFT,
    FRAMED_PANEL_GEOMETRY_ID } from "../compositionConstants/framedPanelCompositionConstants";
import FramedPanelCompositionParams from "../compositionParams/framedPanelCompositionParams";
import FramedPanelBuilder from "./framedPanelBuilder";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";

// White until the object gives the glow its light's color (see LampObjectTypeConfig), so a missed one
// shows rather than looking undrawn.
const GLOW_PLACEHOLDER_COLOR = {x: 255, y: 255, z: 255};

// A glowing square inside an optional moulded band. The glow covers the surface inside the band, so the
// board's own color never shows.
class LampFrame_0 extends FramedPanelBuilder
{
    override run(): InstancedMeshCompositionBuilder
    {
        const params = this.params as FramedPanelCompositionParams;
        if (params.framed)
            this.addBoard(params.colors.frame);
        this.addPartRelativeToBase({
            geometryId: FRAMED_PANEL_GEOMETRY_ID,
            materialId: INSTANCED_EMISSIVE_MATERIAL_ID,
            dir: BACKWARD_DIR,
            offset: {x: 0, y: 0, z: FRAMED_PANEL_BOARD_RELIEF + (params.framed ? FRAMED_PANEL_CONTENT_LIFT : 0)},
            scale: FramedPanelCompositionConstants.getInnerSize(params, this.objectSize),
            color: {...GLOW_PLACEHOLDER_COLOR},
        });
        return this;
    }
}
InstancedMeshCompositionBuilderMap["LampFrame_0"] =
    (params, parts, objectSize) => new LampFrame_0(params, parts, objectSize);
