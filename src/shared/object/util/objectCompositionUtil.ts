import { InstancedMeshCompositionCodecMap } from "../../graphics/mesh/composition/maps/instancedMeshCompositionCodecMap";
import { InstancedMeshCompositionParams } from "../../graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../../graphics/mesh/composition/types/instancedMeshCompositionPart";
import CompositionMetadataUtil from "../../graphics/mesh/composition/util/compositionMetadataUtil";
import StringUtil from "../../math/util/stringUtil";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import AddObjectSignal from "../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import ObjectTypeConfig from "../types/objectTypeConfig/objectTypeConfig";
import ObjectScaleUtil from "./objectScaleUtil";

// The look an object is composed in (see InstancedMeshComposer), read from the object alone, so that whatever
// draws one draws the same.
const ObjectCompositionUtil =
{
    // Fills params and parts in with the object's look at its size: what its metadata stores, or its type's
    // default where it stores none this build can read. Left as they are for a type that composes nothing.
    decode: (obj: AddObjectSignal, params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]): void =>
    {
        const composerConfig = getComposerConfig(obj);
        if (!composerConfig)
            return;

        const metadata = obj.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition];
        if (!metadata || !canDecode(metadata.str, obj, composerConfig))
        {
            const defaults = composerConfig.generateDefaultParts(obj);
            Object.assign(params, defaults.params);
            for (let i = 0; i < defaults.parts.length; ++i)
                parts.push(defaults.parts[i]);
        }
        else
        {
            InstancedMeshCompositionCodecMap[composerConfig.codecType].decode(metadata.str,
                ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, obj.transform.scale), params, parts);
        }
        ObjectCompositionUtil.deriveParts(obj, parts);
    },
    // What the parts take from the object rather than the composition (see ObjectTypeConfig).
    deriveParts: (obj: AddObjectSignal, parts: InstancedMeshCompositionPart[]): void =>
    {
        getComposerConfig(obj)?.deriveParts?.(obj, parts);
    },
}

function getComposerConfig(obj: AddObjectSignal):
    NonNullable<ObjectTypeConfig["components"]["spawnedByAny"]>["instancedMeshComposer"]
{
    return ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).components.spawnedByAny?.instancedMeshComposer;
}

function canDecode(str: string, obj: AddObjectSignal,
    composerConfig: NonNullable<ReturnType<typeof getComposerConfig>>): boolean
{
    const codecType = StringUtil.convertVisibleASCIIToRawNumber(str, 0, 0);
    if (codecType != composerConfig.codecType || !InstancedMeshCompositionCodecMap[codecType])
    {
        console.error(`ObjectCompositionUtil::canDecode :: CodecType mismatch (expected: ${composerConfig.codecType}, decoded: ${codecType})`);
        return false;
    }
    // Added objects' metadata is not checked by the server, and another type's entry builds parts and
    // params this object can't place.
    const objectType = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).objectType;
    if (codecType == InstancedMeshCompositionCodecTypeEnumMap.Indexed
        && !CompositionMetadataUtil.isIndexedLookOf(objectType, composerConfig.codecVersion, str))
    {
        console.error(`ObjectCompositionUtil::canDecode :: Not one of the type's own looks (objectType: ${objectType}, str: ${str})`);
        return false;
    }
    const codecVersion = StringUtil.convertVisibleASCIIToRawNumber(str, 1, 0);
    if (codecVersion != composerConfig.codecVersion)
    {
        // Codecs are expected to migrate outdated versions inside decode.
        console.warn(`ObjectCompositionUtil::canDecode :: CodecVersion mismatch (expected: ${composerConfig.codecVersion}, decoded: ${codecVersion}). An automatic version migration logic should run.`);
    }
    return true;
}

export default ObjectCompositionUtil;
