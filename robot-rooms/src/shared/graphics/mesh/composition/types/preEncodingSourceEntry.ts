import { InstancedMeshCompositionParams } from "./compositionParams/instancedMeshCompositionParams";
import PreEncodingSourcePart from "./preEncodingSourcePart";

// One authored entry of pre_encoding_source.json: parts for the Default codec, which spells them out;
// params for any other, which builds its parts from them.
export default interface PreEncodingSourceEntry
{
    comment?: string,
    objectType: string,
    codecType: string,
    codecVersion?: number,
    parts?: PreEncodingSourcePart[],
    params?: InstancedMeshCompositionParams,
}
