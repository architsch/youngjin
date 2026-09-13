import StringUtil from "../../../../math/util/stringUtil";
import { InstancedMeshCompositionCodecMap } from "../maps/instancedMeshCompositionCodecMap";
import { InstancedMeshCompositionParams } from "../types/compositionParams/instancedMeshCompositionParams";
import { InstancedMeshCompositionCodecType, InstancedMeshCompositionCodecTypeEnumMap } from "../types/instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../types/instancedMeshCompositionPart";

// How an object's appearance is written down as metadata: two characters saying which codec is to
// read what follows and which version of that codec wrote it, and then that codec's own encoding of
// the appearance itself (see InstancedMeshComposition).
//
// An appearance is ordinarily encoded by the client whose user chose it. This is here for the other
// case — an appearance chosen once, in code, for something the game builds itself. What that needs
// is exactly the same string, so it is written by the same codec rather than by a second hand that
// could come to disagree with it about what the characters mean.
const CompositionMetadataUtil =
{
    getCodecPrefix: (codecType: InstancedMeshCompositionCodecType, codecVersion: number): string =>
    {
        return StringUtil.convertRawNumberToVisibleASCII(codecType)
            + StringUtil.convertRawNumberToVisibleASCII(codecVersion);
    },

    // The metadata for an appearance stated outright, as the parameters the codec draws it from —
    // the colors of a door, the parts and colors of a character. No parts are handed over with them,
    // because a codec of this kind stores the parameters alone and builds its parts back from them
    // on the way in; the Default codec, which stores parts instead, has no appearance to be chosen
    // this way.
    encode: (codecType: InstancedMeshCompositionCodecType, codecVersion: number,
        params: InstancedMeshCompositionParams): string =>
    {
        return CompositionMetadataUtil.getCodecPrefix(codecType, codecVersion)
            + InstancedMeshCompositionCodecMap[codecType].encode(params, []);
    },

    // Builds an appearance out of one of the compositions authored and encoded at build time, named
    // by its position in the pre-encoded table (see IndexedCompositionCodec).
    //
    // The codec is reached through the map rather than by importing its module, and that is load
    // bearing rather than tidiness: the Indexed codec imports the codec map and the map imports the
    // codec back, so the two are a cycle that resolves only when the map is the one evaluated first.
    // Importing the codec module directly puts it at the head of the cycle, and the map then builds
    // itself while the codec it is reaching for is still being declared.
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
