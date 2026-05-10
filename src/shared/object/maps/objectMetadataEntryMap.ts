import { OBJECT_MESSAGE_MAX_LENGTH } from "../../system/sharedConstants";
import StringUtil from "../../system/util/stringUtil";
import ObjectMetadataEntry from "../types/objectMetadataEntry";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";

const entries: {[key: number]: ObjectMetadataEntry} = {
    [ObjectMetadataKeyEnumMap.SentMessage]: {
        preprocessingMethod: (rawValue: string) => StringUtil.truncateByCodePoints(rawValue.trim(), OBJECT_MESSAGE_MAX_LENGTH),
        unselectObjectOnSet: false,
    },
    [ObjectMetadataKeyEnumMap.ImagePath]: {
        preprocessingMethod: (rawValue: string) => rawValue,
        unselectObjectOnSet: true,
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
    shouldUnselectObjectOnSet: (metadataKey: number): boolean =>
    {
        const entry = entries[metadataKey];
        if (entry)
            return entry.unselectObjectOnSet;
        return false;
    },
}

export default ObjectMetadataEntryMap;
