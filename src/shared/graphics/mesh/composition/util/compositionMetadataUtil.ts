import StringUtil from "../../../../math/util/stringUtil";
import { InstancedMeshCompositionCodecMap } from "../maps/instancedMeshCompositionCodecMap";
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

    // An appearance from a pre-encoded table index (see IndexedCompositionCodec). The codec is reached
    // through the map, not imported, because of an import cycle that only resolves when the map loads first.
    decodeIndexed: (compositionIndex: number, codecVersion: number,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]): void =>
    {
        const codecType = InstancedMeshCompositionCodecTypeEnumMap.Indexed;
        const codec = InstancedMeshCompositionCodecMap[codecType];
        const metadata = CompositionMetadataUtil.getCodecPrefix(codecType, codecVersion)
            + codec.encode({compositionIndex}, []);
        codec.decode(metadata, decodedParams, decodedParts);
    },
}

export default CompositionMetadataUtil;
