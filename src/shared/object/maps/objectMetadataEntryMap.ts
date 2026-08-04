import { OBJECT_MESSAGE_MAX_LENGTH, OBJECT_INSTANCED_MESH_COMPOSITION_METADATA_MAX_LENGTH } from "../../system/sharedConstants";
import StringUtil from "../../math/util/stringUtil";
import ObjectMetadataEntry from "../types/objectMetadataEntry";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";

const entries: {[key: number]: ObjectMetadataEntry} = {
    [ObjectMetadataKeyEnumMap.SentMessage]: {
        preprocessingMethod: (rawValue: string) => StringUtil.truncateByCodePoints(rawValue.trim(), OBJECT_MESSAGE_MAX_LENGTH),
    },
    [ObjectMetadataKeyEnumMap.ImagePath]: {
        preprocessingMethod: (rawValue: string) => rawValue,
    },
    [ObjectMetadataKeyEnumMap.InstancedMeshComposition]: {
        preprocessingMethod: (rawValue: string) => StringUtil.truncateByCodePoints(rawValue, OBJECT_INSTANCED_MESH_COMPOSITION_METADATA_MAX_LENGTH),
    },
    [ObjectMetadataKeyEnumMap.CanvasFrameCoords]: {
        preprocessingMethod: (rawValue: string) => rawValue,
    },
};

const ObjectMetadataEntryMap =
{
    getEntry: (metadataKey: number): ObjectMetadataEntry | undefined =>
    {
        return entries[metadataKey];
    },
    preprocess: (metadataKey: number, rawValue: string): string =>
    {
        const entry = entries[metadataKey];
        if (entry)
            return entry.preprocessingMethod(rawValue);
        return rawValue;
    },
}

export default ObjectMetadataEntryMap;
