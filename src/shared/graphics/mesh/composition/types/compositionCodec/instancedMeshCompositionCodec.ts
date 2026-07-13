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
}