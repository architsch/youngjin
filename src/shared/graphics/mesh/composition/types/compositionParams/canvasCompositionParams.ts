import Vec3 from "../../../../../math/types/vec3";
import { InstancedMeshCompositionParams } from "./instancedMeshCompositionParams";

// A canvas frame's wood-material inputs, the only thing that varies between canvases (see
// CanvasCompositionConstants).
export default interface CanvasCompositionParams extends InstancedMeshCompositionParams
{
    ids: {
        instancedMeshId_square: string,
    },
    colors: {
        frame: Vec3, // the moulding band around the edge
        inner: Vec3, // the surface inside the band, where the picture hangs
    },
    mouldingThickness: number, // band width, in world units
    mouldingIsConvex: boolean,
    framed: boolean, // without a frame, the finish above is kept but not drawn
}
