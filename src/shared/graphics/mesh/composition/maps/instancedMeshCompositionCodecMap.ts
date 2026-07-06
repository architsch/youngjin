import InstancedMeshCompositionCodec from "../types/compositionCodec/instancedMeshCompositionCodec";
import { DefaultCompositionCodec } from "../types/compositionCodec/defaultCompositionCodec";
import { PlayerCompositionCodec } from "../types/compositionCodec/playerCompositionCodec";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../types/instancedMeshCompositionCodecType";

export const InstancedMeshCompositionCodecMap: {[codecType: number]: InstancedMeshCompositionCodec} = {
    [InstancedMeshCompositionCodecTypeEnumMap.Default]: DefaultCompositionCodec,
    [InstancedMeshCompositionCodecTypeEnumMap.Player]: PlayerCompositionCodec,
}
