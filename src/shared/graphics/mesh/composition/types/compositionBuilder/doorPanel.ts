import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import DoorCompositionConstants from "../compositionConstants/doorCompositionConstants";
import DoorCompositionBuilder from "./doorCompositionBuilder";
import InstancedMeshCompositionBuilder from "./instancedMeshCompositionBuilder";

// The panelled door: a slab with a moulded frame around its outline, two pairs of sunk panels either
// side of the mid stile, the destination plate above them, and a knob on the lock rail. Seven quads
// in all, laid down back to front so that each one sits in front of whatever it is let into.
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

        // A knob is round, and this one is square: giving it a shape of its own would mean a second
        // geometry, a second instanced mesh and a second draw call for one small part of one object.
        // At the size it is drawn, and with the moulding rounding its face off, the difference is
        // not worth any of that.
        this.addRegion(c.knob, knob);
        return this;
    }
}
InstancedMeshCompositionBuilderMap["DoorPanel_0"] =
    (params, parts) => new DoorPanel_0(params, parts);
