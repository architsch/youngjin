import StringUtil from "../../../../math/util/stringUtil";
import { InstancedMeshCompositionCodecMap } from "../maps/instancedMeshCompositionCodecMap";
import { InstancedMeshCompositionParams } from "../types/compositionParams/instancedMeshCompositionParams";
import { InstancedMeshCompositionCodecType } from "../types/instancedMeshCompositionCodecType";

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
}

export default CompositionMetadataUtil;
