import NumUtil from "../../../../../math/util/numUtil";
import StringUtil from "../../../../../math/util/stringUtil";
import { InstancedMeshCompositionCodecMap } from "../../maps/instancedMeshCompositionCodecMap";
import PreEncodedCompositionStringMap from "../../maps/preEncodedCompositionStringMap";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import { InstancedMeshCompositionCodecType, InstancedMeshCompositionCodecTypeEnumMap } from "../instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// An appearance named rather than spelled out: the object stores a position in
// PreEncodedCompositionStringMap, and the real composition lives there, authored once and encoded at
// build time (see PreEncodedCompositionBuilder).
//
// This is not a format of its own — it is a router. What it stores is two characters, so an object's
// whole appearance costs four including the prefix, however many parts it is drawn from; and what it
// points at is an ordinary composition string carrying its own codec prefix, which this hands
// straight to the codec that wrote it. The saving is the point: every object's metadata is inlined
// once per object in the room's stored contents, so an appearance shared by a hundred objects is
// paid for a hundred times when spelled out and once when named.
//
// The index is two base-94 digits, most significant first.
const INDEX_CHAR_INDEX = 2; // The first two chars are this codec's own type and version.
const INDEX_RADIX = 94;
const MAX_COMPOSITION_INDEX = INDEX_RADIX * INDEX_RADIX - 1;

export const IndexedCompositionCodec: InstancedMeshCompositionCodec = {
    encode: (params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]): string =>
    {
        // The parts are not written down at all — they belong to the pre-encoded composition, and
        // writing them here would be storing the very thing this codec exists to avoid storing.
        const rawIndex = params?.compositionIndex;
        const compositionIndex = Number.isFinite(rawIndex)
            ? NumUtil.clampInRange(Math.round(rawIndex), 0, MAX_COMPOSITION_INDEX) : 0;
        return StringUtil.convertRawNumberToVisibleASCII(Math.floor(compositionIndex / INDEX_RADIX))
            + StringUtil.convertRawNumberToVisibleASCII(compositionIndex % INDEX_RADIX);
    },
    decode: (strToDecode: string,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]): void =>
    {
        const upperDigit = StringUtil.convertVisibleASCIIToRawNumber(strToDecode, INDEX_CHAR_INDEX, 0);
        const lowerDigit = StringUtil.convertVisibleASCIIToRawNumber(strToDecode, INDEX_CHAR_INDEX + 1, 0);
        const compositionIndex = upperDigit * INDEX_RADIX + lowerDigit;

        buildPartsFromPreEncodedComposition(compositionIndex, decodedParams, decodedParts);

        // Recorded after the parts have been built, and on every path rather than only the one that
        // found something: a codec that stores its appearance as params replaces them wholesale on
        // the way in (see DoorCompositionCodec), and an index that named nothing is still the index
        // this object carries — writing it back out has to give back the string that arrived.
        decodedParams.compositionIndex = compositionIndex;
    },
    getRandomComposition: (seed: number):
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
    {
        throw new Error("IndexedCompositionCodec::getRandomComposition : NOT IMPLEMENTED");
    },
}

// Reading is total, as it is for every other codec: this string arrives from the database and from
// other clients, so an index naming a composition that does not exist has to leave the object
// drawable rather than throw part-way through building a room. Every way of failing here leaves the
// object with no parts, which draws nothing and breaks nothing.
function buildPartsFromPreEncodedComposition(compositionIndex: number,
    decodedParams: InstancedMeshCompositionParams,
    decodedParts: InstancedMeshCompositionPart[]): void
{
    // The first composition is the fallback, and a table with nothing in it yet has no fallback to
    // give — which is the state the build starts from, before the table has been generated.
    const actualStrToDecode = PreEncodedCompositionStringMap[compositionIndex]
        ?? PreEncodedCompositionStringMap[0];
    if (actualStrToDecode == undefined)
        return;

    const codecType: InstancedMeshCompositionCodecType =
        StringUtil.convertVisibleASCIIToRawNumber(actualStrToDecode, 0);

    // A pre-encoded composition that named this codec would send us back through here forever, and
    // an index is not a thing an index can usefully point at.
    if (codecType == InstancedMeshCompositionCodecTypeEnumMap.Indexed)
        return;

    const actualCodec = InstancedMeshCompositionCodecMap[codecType];
    if (actualCodec == undefined)
        return;

    actualCodec.decode(actualStrToDecode, decodedParams, decodedParts);
}
