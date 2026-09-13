import { OBJECT_MESSAGE_MAX_LENGTH, OBJECT_INSTANCED_MESH_COMPOSITION_METADATA_MAX_LENGTH,
    OBJECT_LABEL_MAX_LENGTH, DOCUMENT_ID_MAX_LENGTH, LABEL_COLOR_PALETTE_NAME } from "../../system/sharedConstants";
import StringUtil from "../../math/util/stringUtil";
import ColorUtil from "../../math/util/colorUtil";
import NumUtil from "../../math/util/numUtil";
import ObjectMetadataEntry from "../types/objectMetadataEntry";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import { DoorTypeEnumMap } from "../types/doorType";
import WallLampObjectTypeConfig from "../types/objectTypeConfig/wallLampObjectTypeConfig";

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
    // Trimmed, since labels are matched by name when routing arrivals.
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
    // Snapped to a valid enum value.
    [ObjectMetadataKeyEnumMap.DoorType]: {
        preprocessingMethod: (rawValue: string) => {
            const doorType = parseInt(rawValue.trim());
            return `${doorTypeValues.includes(doorType) ? doorType : DoorTypeEnumMap.CustomEntrance}`;
        },
    },
    // A lettering palette position; non-numeric input falls back to index 0 (a visible, fixable result).
    [ObjectMetadataKeyEnumMap.LabelColor]: {
        preprocessingMethod: (rawValue: string) => {
            const index = parseInt(rawValue.trim());
            if (isNaN(index))
                return "0";
            return `${NumUtil.clampInRange(index, 0,
                ColorUtil.getPaletteSize(LABEL_COLOR_PALETTE_NAME) - 1)}`;
        },
    },
    // Round-tripped through WallLampObjectTypeConfig's util, which clamps both values and fills
    // defaults, so any input becomes a valid fixed-width pair (see ObjectMetadataEntryMap.preprocess).
    [ObjectMetadataKeyEnumMap.LightProperties]: {
        preprocessingMethod: (rawValue: string) => WallLampObjectTypeConfig.util.canonicalize(rawValue),
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
