import Vec3 from "../../../../../math/types/vec3";
import { InstancedMeshCompositionParams } from "./instancedMeshCompositionParams";

// A framed panel's look (canvases, labels): a moulded board's wood inputs. What the board frames (a picture,
// text) is the type's own (see FramedPanelCompositionConstants).
export default interface FramedPanelCompositionParams extends InstancedMeshCompositionParams
{
    colors: {
        frame: Vec3, // the moulding band around the edge
        inner: Vec3, // the surface inside the band
    },
    mouldingThickness: number, // band width, in world units
    mouldingIsConvex: boolean,
    framed: boolean, // without a frame there is no board, and the finish above is not drawn
}
