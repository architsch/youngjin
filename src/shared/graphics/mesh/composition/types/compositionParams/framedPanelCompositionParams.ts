import Vec3 from "../../../../../math/types/vec3";
import { InstancedMeshCompositionParams } from "./instancedMeshCompositionParams";

// A framed panel's look (canvases, lamps, labels): a moulded board's wood inputs and how far inside the
// object's footprint it is drawn. What the board frames (a picture, a glow, text) is the type's own (see
// FramedPanelCompositionConstants).
export default interface FramedPanelCompositionParams extends InstancedMeshCompositionParams
{
    colors: {
        frame: Vec3, // the moulding band around the edge
        inner?: Vec3, // the surface inside the band, for types whose board shows there
    },
    mouldingThickness: number, // band width, in world units
    mouldingIsConvex: boolean,
    framed: boolean, // without a frame, the finish above is kept but not drawn
    margin: number, // how far inside its footprint the panel is drawn on every side, in world units
}
