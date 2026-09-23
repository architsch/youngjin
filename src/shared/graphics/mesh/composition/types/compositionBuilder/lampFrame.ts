import { BACKWARD_DIR, INSTANCED_EMISSIVE_MATERIAL_ID, INSTANCED_WOOD_MATERIAL_ID } from "../../../../../system/sharedConstants";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import { LAMP_BOARD_RELIEF, LAMP_GEOMETRY_ID, LAMP_GLOW_LIFT } from "../compositionConstants/lampCompositionConstants";
import MarginCompositionConstants from "../compositionConstants/marginCompositionConstants";
import LampCompositionParams from "../compositionParams/lampCompositionParams";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";

// White until the object gives the glow its light's color (see LampObjectTypeConfig), so a missed one
// shows rather than looking undrawn.
const GLOW_PLACEHOLDER_COLOR = {x: 255, y: 255, z: 255};

// A glowing square inside an optional moulded band, both a margin inside the footprint. Faces local
// forward; the object's rotation carries its facing.
class LampFrame_0 extends InstancedMeshCompositionBuilder
{
    override run(): InstancedMeshCompositionBuilder
    {
        const params = this.params as LampCompositionParams;
        const band = params.framed ? params.mouldingThickness : 0;
        const width = MarginCompositionConstants.getDrawnSize(this.objectSize.x, params.margin, band);
        const height = MarginCompositionConstants.getDrawnSize(this.objectSize.y, params.margin, band);

        if (params.framed)
        {
            // The glow covers the surface inside the band, so its own color never shows.
            this.addPartRelativeToBase({
                geometryId: LAMP_GEOMETRY_ID,
                materialId: INSTANCED_WOOD_MATERIAL_ID,
                dir: BACKWARD_DIR,
                offset: {x: 0, y: 0, z: LAMP_BOARD_RELIEF},
                scale: {x: width, y: height, z: 1},
                color: params.colors.frame,
                mouldingColor: params.colors.frame,
                mouldingThickness: params.mouldingThickness,
                mouldingIsConvex: params.mouldingIsConvex,
            });
        }
        this.addPartRelativeToBase({
            geometryId: LAMP_GEOMETRY_ID,
            materialId: INSTANCED_EMISSIVE_MATERIAL_ID,
            dir: BACKWARD_DIR,
            offset: {x: 0, y: 0, z: LAMP_BOARD_RELIEF + (params.framed ? LAMP_GLOW_LIFT : 0)},
            scale: {x: width - 2 * band, y: height - 2 * band, z: 1},
            color: {...GLOW_PLACEHOLDER_COLOR},
        });
        return this;
    }
}
InstancedMeshCompositionBuilderMap["LampFrame_0"] =
    (params, parts, objectSize) => new LampFrame_0(params, parts, objectSize);
