import Vec3 from "../../../../../math/types/vec3";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";

export default interface InstancedMeshCompositionCodec
{
    encode: (params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]) => string;
    // objectSize: the footprint the parts have to fill, in world units (see ObjectScaleUtil). A codec
    // for a resizable type lays its parts out against it; one for a fixed-size type ignores it. It is
    // not stored, so a resize is a re-decode rather than a rewrite.
    decode: (strToDecode: string, objectSize: Vec3,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]) => void;
    getRandomComposition: (seed: number, objectSize: Vec3) =>
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]};
    // Encoded bodies (no prefix) covering every distinct set of parts the codec can build; values that
    // don't change which parts are built (e.g. colors) may be left at any value. Sizes the meshes (see
    // InstancedMeshCapacityBuilder).
    getStructuralVariants: () => string[];
}
