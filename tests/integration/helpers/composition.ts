/**
 * Helpers for building player mesh-composition metadata strings.
 *
 * The wire format of the InstancedMeshComposition metadata is a two-character codec prefix
 * (type, then version) followed by the codec's encoded params. These helpers reproduce that
 * format the way a real client would, reading the codec type/version from the object config
 * so the tests stay honest if the config changes.
 */
import PlayerObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { PlayerCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/playerCompositionCodec";
import { InstancedMeshCompositionParams } from "../../../src/shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import StringUtil from "../../../src/shared/math/util/stringUtil";

const composerConfig = PlayerObjectTypeConfig.components.spawnedByAny!.instancedMeshComposer!;

export const PLAYER_CODEC_TYPE = composerConfig.codecType;
export const PLAYER_CODEC_VERSION = composerConfig.codecVersion;

/** The two-character prefix every encoded composition starts with. */
export function playerCodecPrefix(
    codecType: number = PLAYER_CODEC_TYPE,
    codecVersion: number = PLAYER_CODEC_VERSION): string
{
    return StringUtil.convertRawNumberToVisibleASCII(codecType)
        + StringUtil.convertRawNumberToVisibleASCII(codecVersion);
}

/** A valid, fully-formed composition metadata string, as a real client would emit it. */
export function encodePlayerComposition(seed: number): string
{
    const {params, parts} = PlayerCompositionCodec.getRandomComposition(seed);
    return playerCodecPrefix() + PlayerCompositionCodec.encode(params, parts);
}

/** Decodes a composition metadata string the way a receiving client's codec would. */
export function decodePlayerComposition(str: string):
    {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]}
{
    const params: InstancedMeshCompositionParams = {};
    const parts: InstancedMeshCompositionPart[] = [];
    PlayerCompositionCodec.decode(str, params, parts);
    return {params, parts};
}
