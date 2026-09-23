import Vec3 from "../../../../../math/types/vec3";
import { InstancedMeshCompositionParams } from "./instancedMeshCompositionParams";

// A lamp's look (see LampCompositionConstants). Its glow's color is not here: it comes from the lamp's
// light, so the lamp can't glow one color and light another.
export default interface LampCompositionParams extends InstancedMeshCompositionParams
{
    colors: {
        frame: Vec3, // the moulding band around the glow
    },
    mouldingThickness: number, // band width, in world units
    mouldingIsConvex: boolean,
    framed: boolean, // without a frame, the finish above is kept but not drawn
    margin: number, // how far inside its footprint the lamp is drawn on every side, in world units
}
