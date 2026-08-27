import Vec3 from "../../../../../math/types/vec3";
import { BACKWARD_DIR, DOOR_FOOTPRINT_HEIGHT } from "../../../../../system/sharedConstants";
import { DoorRegion } from "../compositionConstants/doorCompositionConstants";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";

// A door's parts are authored in panel space — origin at the bottom center of the visible panel —
// while the object they belong to is centered on its own collider. This is the shift between the
// two: the panel is centered across the footprint and flush with its bottom, so the panel's origin
// sits half the footprint's height below the object's, and the difference between the footprint and
// the panel is left as clearance at the top.
const PANEL_ORIGIN_Y = -0.5 * DOOR_FOOTPRINT_HEIGHT;

export default class DoorCompositionBuilder extends InstancedMeshCompositionBuilder
{
    run(): InstancedMeshCompositionBuilder
    {
        throw new Error("DoorCompositionBuilder :: Method 'run' must be overriden by its child class.");
    }

    // Lays one rectangular region of the door's face over whatever is already there. The region's
    // relief is what keeps it in front of the parts below it, which is what stops flat quads sharing
    // a plane from z-fighting (see DoorCompositionConstants).
    //
    // A region's moulding is given the region's own color, because it is not trim laid on the door
    // but a profile worked into the timber the region is cut from. What makes it visible is the way
    // the light falls across it (see the "InstancedWood" material), not any contrast against the
    // face around it.
    //
    // The mirrored variant places the same region on the far side of the door's center line, which
    // is how the panels come in pairs without being written out twice.
    protected addRegion(region: DoorRegion, color: Vec3, mirrored: boolean = false)
    {
        this.addPartRelativeToBase({
            instancedMeshId: this.params.ids.instancedMeshId_square,
            // A wall attachment already carries its facing in the object's own rotation, taken from
            // the direction it was hung in, so every part of it simply faces the object's local
            // forward and turns with the wall (the same as CanvasGameObject's single quad).
            dir: BACKWARD_DIR,
            offset: {
                x: mirrored ? -region.offset.x : region.offset.x,
                y: PANEL_ORIGIN_Y + region.offset.y,
                // Relief is measured out along the face the door presents to the room, which is the
                // side of the object the wall is not on.
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
