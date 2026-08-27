/**
 * Helpers for building mesh-composition metadata strings, for the two kinds of object that carry
 * one: a player's appearance and a door's.
 *
 * The wire format of the InstancedMeshComposition metadata is a two-character codec prefix
 * (type, then version) followed by the codec's encoded params. These helpers reproduce that
 * format the way a real client would, reading the codec type/version from the object config
 * so the tests stay honest if the config changes.
 */
import PlayerObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import DoorObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { PlayerCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/playerCompositionCodec";
import { DoorCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/doorCompositionCodec";
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

const doorComposerConfig = DoorObjectTypeConfig.components.spawnedByAny!.instancedMeshComposer!;

export const DOOR_CODEC_TYPE = doorComposerConfig.codecType;
export const DOOR_CODEC_VERSION = doorComposerConfig.codecVersion;

/** The two-character prefix every encoded door composition starts with. */
export function doorCodecPrefix(
    codecType: number = DOOR_CODEC_TYPE,
    codecVersion: number = DOOR_CODEC_VERSION): string
{
    return StringUtil.convertRawNumberToVisibleASCII(codecType)
        + StringUtil.convertRawNumberToVisibleASCII(codecVersion);
}

/** A valid, fully-formed door composition metadata string. */
export function encodeDoorComposition(seed: number): string
{
    const {params, parts} = DoorCompositionCodec.getRandomComposition(seed);
    return doorCodecPrefix() + DoorCompositionCodec.encode(params, parts);
}

/** Decodes a door composition metadata string the way a receiving client's codec would. */
export function decodeDoorComposition(str: string):
    {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]}
{
    const params: InstancedMeshCompositionParams = {};
    const parts: InstancedMeshCompositionPart[] = [];
    DoorCompositionCodec.decode(str, params, parts);
    return {params, parts};
}

/** The composition a door falls back on when it carries no metadata of its own. */
export function generateDefaultDoorComposition(roomID: string, objectId: string):
    {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]}
{
    return doorComposerConfig.generateDefaultParts(
        new AddObjectSignal(roomID, "", "",
            ObjectTypeConfigMap.getIndexByType("Door"), objectId,
            new ObjectTransform({x: 0, y: 0, z: 0}, {x: 0, y: 0, z: -1})));
}
