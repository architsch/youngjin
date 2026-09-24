/**
 * Builds player composition metadata strings (two-char codec prefix + encoded params), using the codec
 * type/version from the object configs, and lists the pre-encoded looks of the types that choose one
 * (doors, canvases, labels) as those objects store and decode them.
 */
import PlayerObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import DoorObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { PlayerCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/playerCompositionCodec";
import { DoorCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/doorCompositionCodec";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import { InstancedMeshCompositionParams } from "../../../src/shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import PreEncodedCompositionIndexMap from "../../../src/shared/graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import CompositionMetadataUtil from "../../../src/shared/graphics/mesh/composition/util/compositionMetadataUtil";
import StringUtil from "../../../src/shared/math/util/stringUtil";
import Vec3 from "../../../src/shared/math/types/vec3";
import { UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";

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
    const {params, parts} = PlayerCompositionCodec.getRandomComposition(seed, UNIT_VEC3);
    return playerCodecPrefix() + PlayerCompositionCodec.encode(params, parts);
}

/** Decodes a composition metadata string the way a receiving client's codec would. */
export function decodePlayerComposition(str: string):
    {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]}
{
    const params: InstancedMeshCompositionParams = {};
    const parts: InstancedMeshCompositionPart[] = [];
    PlayerCompositionCodec.decode(str, UNIT_VEC3, params, parts);
    return {params, parts};
}

const doorComposerConfig = DoorObjectTypeConfig.components.spawnedByAny!.instancedMeshComposer!;

/** The two-character prefix a door's finish starts with inside each of its pre-encoded looks. */
export function doorCodecPrefix(): string
{
    return CompositionMetadataUtil.getCodecPrefix(InstancedMeshCompositionCodecTypeEnumMap.Door, 0);
}

/** Decodes a door finish the way the door codec reads one out of a pre-encoded look. */
export function decodeDoorComposition(str: string):
    {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]}
{
    const params: InstancedMeshCompositionParams = {};
    const parts: InstancedMeshCompositionPart[] = [];
    DoorCompositionCodec.decode(str, UNIT_VEC3, params, parts);
    return {params, parts};
}

/** The composition a door falls back on when it carries no metadata of its own. */
export function generateDefaultDoorComposition(roomID: string, objectId: string):
    {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]}
{
    return doorComposerConfig.generateDefaultParts(
        new AddObjectSignal(roomID, "", "",
            ObjectTypeConfigMap.getIndexByType("Door"), objectId,
            new ObjectTransform({x: 0, y: 0, z: 0}, {x: 0, y: 0, z: -1}, {...UNIT_VEC3})));
}

/**
 * Each of a type's pre-encoded looks, in chooser order: its composition index, the string an object of the
 * type stores to show it, and what it decodes to at the given size.
 */
export function getLooks(objectType: string, objectSize: Vec3 = UNIT_VEC3): {compositionIndex: number,
    stored: string, params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]}[]
{
    const config = ObjectTypeConfigMap.getConfigByIndex(ObjectTypeConfigMap.getIndexByType(objectType));
    const codecVersion = config.components.spawnedByAny!.instancedMeshComposer!.codecVersion;
    return (PreEncodedCompositionIndexMap[objectType] ?? []).map(compositionIndex => {
        const params: InstancedMeshCompositionParams = {};
        const parts: InstancedMeshCompositionPart[] = [];
        CompositionMetadataUtil.decodeIndexed(compositionIndex, codecVersion, objectSize, params, parts);
        return {compositionIndex, stored: CompositionMetadataUtil.encodeIndexed(compositionIndex, codecVersion),
            params, parts};
    });
}
