import InstancedMeshCompositionCodec from "../types/compositionCodec/instancedMeshCompositionCodec";
import { DefaultCompositionCodec } from "../types/compositionCodec/defaultCompositionCodec";
import { PlayerCompositionCodec } from "../types/compositionCodec/playerCompositionCodec";
import { DoorCompositionCodec } from "../types/compositionCodec/doorCompositionCodec";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../types/instancedMeshCompositionCodecType";

export const InstancedMeshCompositionCodecMap: {[codecType: number]: InstancedMeshCompositionCodec} = {
    [InstancedMeshCompositionCodecTypeEnumMap.Default]: DefaultCompositionCodec,
    [InstancedMeshCompositionCodecTypeEnumMap.Player]: PlayerCompositionCodec,
    [InstancedMeshCompositionCodecTypeEnumMap.Door]: DoorCompositionCodec,
}
