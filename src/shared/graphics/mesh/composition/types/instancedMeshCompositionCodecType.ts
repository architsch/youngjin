export type InstancedMeshCompositionCodecType = number;

export const InstancedMeshCompositionCodecTypeEnumMap: Record<string, number> =
{
    Default: 0,
    Player: 1,
    Door: 2,
    Indexed: 3,
    // 4 and 6 were canvases' and labels' editable looks, before both became a choice of pre-encoded ones; 5
    // was lamps' framed look, before a lamp's look followed its size. Never reuse a stored value.
    FramedPanel: 7,
}