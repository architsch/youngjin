export type InstancedMeshCompositionCodecType = number;

export const InstancedMeshCompositionCodecTypeEnumMap: Record<string, number> =
{
    Default: 0,
    Player: 1,
    Door: 2,
    Indexed: 3,
    Canvas: 4,
    // 5 was lamps' framed look, before a lamp's look followed its size. Never reuse a stored value.
    Label: 6,
}