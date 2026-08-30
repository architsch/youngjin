import { OBJECT_MESSAGE_MAX_LENGTH, OBJECT_INSTANCED_MESH_COMPOSITION_METADATA_MAX_LENGTH,
    OBJECT_LABEL_MAX_LENGTH, DOCUMENT_ID_MAX_LENGTH, LABEL_COLOR_PALETTE_NAME } from "../../system/sharedConstants";
import StringUtil from "../../math/util/stringUtil";
import ColorUtil from "../../math/util/colorUtil";
import NumUtil from "../../math/util/numUtil";
import ObjectMetadataEntry from "../types/objectMetadataEntry";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import { DoorTypeEnumMap } from "../types/doorType";

const doorTypeValues = Object.values(DoorTypeEnumMap);

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
    // A label is both drawn on the object and searched for by name (a door is found by its label
    // when an arriving player asks for it), so the surrounding whitespace goes: a name that is not
    // the name it looks like is a door nobody can route to.
    [ObjectMetadataKeyEnumMap.Label]: {
        preprocessingMethod: (rawValue: string) => StringUtil.truncateByCodePoints(rawValue.trim(), OBJECT_LABEL_MAX_LENGTH),
    },
    [ObjectMetadataKeyEnumMap.DestinationRoomId]: {
        preprocessingMethod: (rawValue: string) => StringUtil.truncateByCodePoints(rawValue.trim(), DOCUMENT_ID_MAX_LENGTH),
    },
    // Matched against another door's Label, so it is trimmed and bounded the same way that is.
    [ObjectMetadataKeyEnumMap.DestinationDoorLabel]: {
        preprocessingMethod: (rawValue: string) => StringUtil.truncateByCodePoints(rawValue.trim(), OBJECT_LABEL_MAX_LENGTH),
    },
    // Snapped to a value the enum actually holds, so that reading it back never has to ask whether
    // what it found is a door type at all.
    [ObjectMetadataKeyEnumMap.DoorType]: {
        preprocessingMethod: (rawValue: string) => {
            const doorType = parseInt(rawValue.trim());
            return `${doorTypeValues.includes(doorType) ? doorType : DoorTypeEnumMap.CustomEntrance}`;
        },
    },
    // A position in the lettering palette, so what is stored is only ever one of the colors on
    // offer. A value that is not a number at all falls back on the first of them rather than being
    // refused, since a label drawn in some color is still a label and an unreadable one is a bug the
    // user can see and fix.
    [ObjectMetadataKeyEnumMap.LabelColor]: {
        preprocessingMethod: (rawValue: string) => {
            const index = parseInt(rawValue.trim());
            if (isNaN(index))
                return "0";
            return `${NumUtil.clampInRange(index, 0,
                ColorUtil.getPaletteSize(LABEL_COLOR_PALETTE_NAME) - 1)}`;
        },
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
