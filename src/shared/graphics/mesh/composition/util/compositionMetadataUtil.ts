import RandomNumberGenerator from "../../../../math/types/randomNumberGenerator";
import Vec3 from "../../../../math/types/vec3";
import StringUtil from "../../../../math/util/stringUtil";
import { InstancedMeshCompositionCodecMap } from "../maps/instancedMeshCompositionCodecMap";
import PreEncodedCompositionIndexMap from "../maps/preEncodedCompositionIndexMap";
import { InstancedMeshCompositionParams } from "../types/compositionParams/instancedMeshCompositionParams";
import { InstancedMeshCompositionCodecType, InstancedMeshCompositionCodecTypeEnumMap } from "../types/instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../types/instancedMeshCompositionPart";

// Composition metadata format: two characters (codec type, codec version) followed by the codec's
// encoding. Used to write appearances chosen in code, through the same codec that decodes them.
const CompositionMetadataUtil =
{
    getCodecPrefix: (codecType: InstancedMeshCompositionCodecType, codecVersion: number): string =>
    {
        return StringUtil.convertRawNumberToVisibleASCII(codecType)
            + StringUtil.convertRawNumberToVisibleASCII(codecVersion);
    },

    // Encodes an appearance from codec params (for params-based codecs; the Default codec stores parts
    // and can't be used this way).
    encode: (codecType: InstancedMeshCompositionCodecType, codecVersion: number,
        params: InstancedMeshCompositionParams): string =>
    {
        return CompositionMetadataUtil.getCodecPrefix(codecType, codecVersion)
            + InstancedMeshCompositionCodecMap[codecType].encode(params, []);
    },

    // An appearance stored as a pre-encoded table index (see IndexedCompositionCodec). The codec is reached
    // through the map, not imported, because of an import cycle that only resolves when the map loads first.
    encodeIndexed: (compositionIndex: number, codecVersion: number): string =>
    {
        return CompositionMetadataUtil.encode(InstancedMeshCompositionCodecTypeEnumMap.Indexed, codecVersion,
            {compositionIndex});
    },

    decodeIndexed: (compositionIndex: number, codecVersion: number, objectSize: Vec3,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]): void =>
    {
        const codec = InstancedMeshCompositionCodecMap[InstancedMeshCompositionCodecTypeEnumMap.Indexed];
        codec.decode(CompositionMetadataUtil.encodeIndexed(compositionIndex, codecVersion), objectSize,
            decodedParams, decodedParts);
    },

    // One of an object type's pre-encoded appearances, from firstPosition on in its list, picked by the seed
    // so that every client and session sees the same one.
    decodeSeededIndexed: (objectType: string, firstPosition: number, seed: number, codecVersion: number,
        objectSize: Vec3): {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
    {
        const compositionIndices = (PreEncodedCompositionIndexMap[objectType] ?? []).slice(firstPosition);
        const compositionIndex = new RandomNumberGenerator(seed).pick(compositionIndices) ?? 0;
        const params: InstancedMeshCompositionParams = {};
        const parts: InstancedMeshCompositionPart[] = [];
        CompositionMetadataUtil.decodeIndexed(compositionIndex, codecVersion, objectSize, params, parts);
        return {params, parts};
    },

    // Whether a stored composition is exactly one of the object type's own pre-encoded appearances. Another
    // type's entry would build parts and params the object can't place.
    isIndexedLookOf: (objectType: string, codecVersion: number, str: string): boolean =>
    {
        return (PreEncodedCompositionIndexMap[objectType] ?? []).some(compositionIndex =>
            CompositionMetadataUtil.encodeIndexed(compositionIndex, codecVersion) === str);
    },
}

export default CompositionMetadataUtil;
