import InstancedMeshCompositionCodec from "../types/mesh/compositionCodec/instancedMeshCompositionCodec";
import { DefaultCompositionCodec } from "../types/mesh/compositionCodec/defaultCompositionCodec";
import { PlayerCompositionCodec } from "../types/mesh/compositionCodec/playerCompositionCodec";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../types/mesh/instancedMeshCompositionCodecType";

export const InstancedMeshCompositionCodecMap: {[codecType: number]: InstancedMeshCompositionCodec} = {
    [InstancedMeshCompositionCodecTypeEnumMap.Default]: DefaultCompositionCodec,
    [InstancedMeshCompositionCodecTypeEnumMap.Player]: PlayerCompositionCodec,
}
