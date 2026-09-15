import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";

export default interface InstancedMeshCompositionCodec
{
    encode: (params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]) => string;
    decode: (strToDecode: string,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]) => void;
    getRandomComposition: (seed: number) =>
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]};
    // Encoded bodies (no prefix) covering every distinct set of parts the codec can build; values that
    // don't change which parts are built (e.g. colors) may be left at any value. Sizes the meshes (see
    // InstancedMeshCapacityBuilder).
    getStructuralVariants: () => string[];
}