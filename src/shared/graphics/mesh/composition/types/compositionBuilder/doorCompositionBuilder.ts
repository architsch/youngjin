import Vec3 from "../../../../../math/types/vec3";
import { BACKWARD_DIR, INSTANCED_WOOD_MATERIAL_ID } from "../../../../../system/sharedConstants";
import { DoorRegion, DOOR_GEOMETRY_ID,
    DOOR_PANEL_ORIGIN_Y } from "../compositionConstants/doorCompositionConstants";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";

export default class DoorCompositionBuilder extends InstancedMeshCompositionBuilder
{
    run(): InstancedMeshCompositionBuilder
    {
        throw new Error("DoorCompositionBuilder :: Method 'run' must be overriden by its child class.");
    }

    // Adds one face region on top of earlier ones; its relief prevents z-fighting (see
    // DoorCompositionConstants). The moulding uses the region's own color (it's carved, seen by
    // relief). `mirrored` places the counterpart across the centre line.
    protected addRegion(region: DoorRegion, color: Vec3, mirrored: boolean = false)
    {
        this.addPartRelativeToBase({
            geometryId: DOOR_GEOMETRY_ID,
            materialId: INSTANCED_WOOD_MATERIAL_ID,
            // Faces local forward; the object's rotation carries the wall facing (as in CanvasGameObject).
            dir: BACKWARD_DIR,
            offset: {
                x: mirrored ? -region.offset.x : region.offset.x,
                y: DOOR_PANEL_ORIGIN_Y + region.offset.y,
                // Relief extends into the room.
                z: region.relief,
            },
            scale: {x: region.size.x, y: region.size.y, z: 1},
            color,
            mouldingColor: color,
            mouldingThickness: region.mouldingThickness,
            mouldingIsConvex: region.mouldingIsConvex,
        });
    }
}
