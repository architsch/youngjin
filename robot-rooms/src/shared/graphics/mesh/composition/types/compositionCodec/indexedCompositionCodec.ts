import Vec3 from "../../../../../math/types/vec3";
import NumUtil from "../../../../../math/util/numUtil";
import StringUtil from "../../../../../math/util/stringUtil";
import { InstancedMeshCompositionCodecMap } from "../../maps/instancedMeshCompositionCodecMap";
import PreEncodedCompositionStringMap from "../../maps/preEncodedCompositionStringMap";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import { InstancedMeshCompositionCodecType, InstancedMeshCompositionCodecTypeEnumMap } from "../instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// A router, not a format: stores a two-digit base-94 index (most significant first) into
// PreEncodedCompositionStringMap and delegates to the codec named by that entry's prefix. Shared
// appearances cost four characters per object instead of a full composition (see
// PreEncodedCompositionBuilder).
const INDEX_CHAR_INDEX = 2; // The first two chars are this codec's own type and version.
const INDEX_RADIX = 94;
const MAX_COMPOSITION_INDEX = INDEX_RADIX * INDEX_RADIX - 1;

export const IndexedCompositionCodec: InstancedMeshCompositionCodec = {
    encode: (params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]): string =>
    {
        // Parts belong to the pre-encoded entry and are never written here.
        const rawIndex = params?.compositionIndex;
        const compositionIndex = Number.isFinite(rawIndex)
            ? NumUtil.clampInRange(Math.round(rawIndex), 0, MAX_COMPOSITION_INDEX) : 0;
        return StringUtil.convertRawNumberToVisibleASCII(Math.floor(compositionIndex / INDEX_RADIX))
            + StringUtil.convertRawNumberToVisibleASCII(compositionIndex % INDEX_RADIX);
    },
    decode: (strToDecode: string, objectSize: Vec3,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]): void =>
    {
        const upperDigit = StringUtil.convertVisibleASCIIToRawNumber(strToDecode, INDEX_CHAR_INDEX, 0);
        const lowerDigit = StringUtil.convertVisibleASCIIToRawNumber(strToDecode, INDEX_CHAR_INDEX + 1, 0);
        const compositionIndex = upperDigit * INDEX_RADIX + lowerDigit;

        buildPartsFromPreEncodedComposition(compositionIndex, objectSize, decodedParams, decodedParts);

        // Always recorded (even if nothing was found) so re-encoding returns the original string.
        decodedParams.compositionIndex = compositionIndex;
    },
    getRandomComposition: (seed: number, objectSize: Vec3):
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
    {
        throw new Error("IndexedCompositionCodec::getRandomComposition : NOT IMPLEMENTED");
    },
    getStructuralVariants: (): string[] =>
    {
        // Its variants are an object type's pre-encoded entries, which the codec doesn't know.
        throw new Error("IndexedCompositionCodec::getStructuralVariants : NOT IMPLEMENTED");
    },
}

// Total: a missing index yields no parts (draws nothing) rather than throwing mid-room-build.
function buildPartsFromPreEncodedComposition(compositionIndex: number, objectSize: Vec3,
    decodedParams: InstancedMeshCompositionParams,
    decodedParts: InstancedMeshCompositionPart[]): void
{
    // Index 0 is the fallback; an empty table (before generation) has none.
    const actualStrToDecode = PreEncodedCompositionStringMap[compositionIndex]
        ?? PreEncodedCompositionStringMap[0];
    if (actualStrToDecode == undefined)
        return;

    const codecType: InstancedMeshCompositionCodecType =
        StringUtil.convertVisibleASCIIToRawNumber(actualStrToDecode, 0);

    // Guards against infinite recursion through an entry that names this codec.
    if (codecType == InstancedMeshCompositionCodecTypeEnumMap.Indexed)
        return;

    const actualCodec = InstancedMeshCompositionCodecMap[codecType];
    if (actualCodec == undefined)
        return;

    actualCodec.decode(actualStrToDecode, objectSize, decodedParams, decodedParts);
}
