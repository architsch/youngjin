import InstancedMeshCompositionCodec from "../types/compositionCodec/instancedMeshCompositionCodec";
import { DefaultCompositionCodec } from "../types/compositionCodec/defaultCompositionCodec";
import { PlayerCompositionCodec } from "../types/compositionCodec/playerCompositionCodec";
import { DoorCompositionCodec } from "../types/compositionCodec/doorCompositionCodec";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../types/instancedMeshCompositionCodecType";
import { IndexedCompositionCodec } from "../types/compositionCodec/indexedCompositionCodec";
import { FramedPanelCompositionCodec } from "../types/compositionCodec/framedPanelCompositionCodec";
import { CannonCompositionCodec } from "../types/compositionCodec/cannonCompositionCodec";
import { CannonBallCompositionCodec } from "../types/compositionCodec/cannonBallCompositionCodec";

export const InstancedMeshCompositionCodecMap: {[codecType: number]: InstancedMeshCompositionCodec} = {
    [InstancedMeshCompositionCodecTypeEnumMap.Default]: DefaultCompositionCodec,
    [InstancedMeshCompositionCodecTypeEnumMap.Player]: PlayerCompositionCodec,
    [InstancedMeshCompositionCodecTypeEnumMap.Door]: DoorCompositionCodec,
    [InstancedMeshCompositionCodecTypeEnumMap.Indexed]: IndexedCompositionCodec,
    [InstancedMeshCompositionCodecTypeEnumMap.FramedPanel]: FramedPanelCompositionCodec,
    [InstancedMeshCompositionCodecTypeEnumMap.Cannon]: CannonCompositionCodec,
    [InstancedMeshCompositionCodecTypeEnumMap.CannonBall]: CannonBallCompositionCodec,
}
