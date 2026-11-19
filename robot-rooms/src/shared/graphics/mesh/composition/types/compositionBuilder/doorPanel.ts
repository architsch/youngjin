import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import DoorCompositionConstants from "../compositionConstants/doorCompositionConstants";
import DoorCompositionBuilder from "./doorCompositionBuilder";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";

// Panelled door: moulded slab, two pairs of sunk panels, plate and knob. Seven quads, back to front.
class DoorPanel_0 extends DoorCompositionBuilder
{
    override run(): InstancedMeshCompositionBuilder
    {
        const c = DoorCompositionConstants;
        const {panel, label, knob} = this.params.colors;

        this.addRegion(c.slab, panel);

        this.addRegion(c.lowerPanel, panel);
        this.addRegion(c.lowerPanel, panel, true);
        this.addRegion(c.upperPanel, panel);
        this.addRegion(c.upperPanel, panel, true);

        this.addRegion(c.label, label);

        // A square knob: a round one would need another geometry, mesh and draw call for no visible gain.
        this.addRegion(c.knob, knob);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["DoorPanel_0"] =
    (params, parts) => new DoorPanel_0(params, parts);
