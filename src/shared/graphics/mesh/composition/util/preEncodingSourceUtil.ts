import { DefaultCompositionCodec } from "../types/compositionCodec/defaultCompositionCodec";
import { InstancedMeshCompositionCodecMap } from "../maps/instancedMeshCompositionCodecMap";
import CompositionMetadataUtil from "./compositionMetadataUtil";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../types/instancedMeshCompositionCodecType";
import { InstancedMeshCompositionParams } from "../types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../types/instancedMeshCompositionPart";
import PreEncodingSourceEntry from "../types/preEncodingSourceEntry";
import PreEncodingSourcePart from "../types/preEncodingSourcePart";
import ColorUtil from "../../../../math/util/colorUtil";
import Vec3 from "../../../../math/types/vec3";
import ObjectTypeConfigMap from "../../../../object/maps/objectTypeConfigMap";
import { COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID, GEOMETRY_CODE_BY_ID,
    INSTANCE_COLORED_MATERIAL_IDS, INSTANCED_WOOD_MATERIAL_ID,
    MATERIAL_CODE_BY_ID, UNIT_VEC3 } from "../../../../system/sharedConstants";

// -1 in the source marks a per-object field (e.g. a lamp face's color, set from its light). It can't
// survive encoding (clamping would store a real value), so a white placeholder is written for the
// object to overwrite; white makes a missed overwrite visibly wrong rather than looking undrawn.
export const PRE_ENCODING_INDETERMINATE = -1;
const INDETERMINATE_COLOR_CHANNEL = 255;

// Encodes one authored entry of pre_encoding_source.json into its PreEncodedCompositionStringMap string
// (see PreEncodedCompositionBuilder). Decoding needs the part builders registered.
const PreEncodingSourceUtil =
{
    // Throws on anything the build must refuse, naming compositionIndex (the entry's position in the source).
    encodeEntry: (entry: PreEncodingSourceEntry, compositionIndex: number): string =>
    {
        validateObjectType(entry, compositionIndex);
        return encodeComposition(entry, compositionIndex);
    },
}

export default PreEncodingSourceUtil;

// An entry belongs to exactly one object type, which must render itself through the indexed codec.
function validateObjectType(entry: PreEncodingSourceEntry, compositionIndex: number): void
{
    if (!entry.objectType || !ObjectTypeConfigMap.hasType(entry.objectType))
        throw new Error(`Composition pre-encoding failed :: Unknown objectType "${entry.objectType}" (compositionIndex = ${compositionIndex})`);

    const config = ObjectTypeConfigMap.getConfigByIndex(ObjectTypeConfigMap.getIndexByType(entry.objectType));
    const codecType = config.components.spawnedByAny?.instancedMeshComposer?.codecType;
    if (codecType != InstancedMeshCompositionCodecTypeEnumMap.Indexed)
        throw new Error(`Composition pre-encoding failed :: objectType "${entry.objectType}" does not use the indexed codec (compositionIndex = ${compositionIndex})`);
}

function encodeComposition(entry: PreEncodingSourceEntry, compositionIndex: number): string
{
    const codecType = InstancedMeshCompositionCodecTypeEnumMap[entry.codecType];
    if (codecType == undefined)
        throw new Error(`Composition pre-encoding failed :: Unknown codecType "${entry.codecType}" (compositionIndex = ${compositionIndex})`);

    // Codecs encode bodies only; the prefix is added here (see CompositionMetadataUtil).
    const codecVersion = entry.codecVersion ?? 0;
    const prefix = CompositionMetadataUtil.getCodecPrefix(codecType, codecVersion);

    if (codecType == InstancedMeshCompositionCodecTypeEnumMap.Indexed)
        throw new Error(`Composition pre-encoding failed :: An entry can't be indexed itself (compositionIndex = ${compositionIndex})`);

    const takesParts = codecType == InstancedMeshCompositionCodecTypeEnumMap.Default;
    const given = takesParts ? entry.parts : entry.params;
    const other = takesParts ? entry.params : entry.parts;
    if (given == undefined || other != undefined)
        throw new Error(`Composition pre-encoding failed :: codecType "${entry.codecType}" takes ${takesParts ? "parts" : "params"} and nothing else (compositionIndex = ${compositionIndex})`);

    if (takesParts)
        return prefix + DefaultCompositionCodec.encode({}, parseDefaultParts(entry.parts!, compositionIndex));
    return encodeParams(entry.params, codecType, prefix, compositionIndex);
}

// A value an entry leaves out is what the codec reads from nothing, and every value it gives must come
// back as written: a color off the palette or a width between steps would draw some other look.
function encodeParams(authoredParams: InstancedMeshCompositionParams, codecType: number, prefix: string,
    compositionIndex: number): string
{
    const codec = InstancedMeshCompositionCodecMap[codecType];
    const params: InstancedMeshCompositionParams = {};
    codec.decode(prefix, UNIT_VEC3, params, []);
    mergeAuthoredValues(params, authoredParams);

    const encoded = prefix + codec.encode(params, []);
    const decodedParams: InstancedMeshCompositionParams = {};
    codec.decode(encoded, UNIT_VEC3, decodedParams, []);
    assertAuthoredValuesSurvive(authoredParams, decodedParams, "params", `compositionIndex = ${compositionIndex}`);
    return encoded;
}

function parseDefaultParts(parts: PreEncodingSourcePart[],
    compositionIndex: number): InstancedMeshCompositionPart[]
{
    return parts.map((part, partIndex) => {
        const where = `compositionIndex = ${compositionIndex}, partIndex = ${partIndex}`;
        if (GEOMETRY_CODE_BY_ID[part.geometryId] == undefined)
            throw new Error(`Composition pre-encoding failed :: Unknown geometryId "${part.geometryId}" (${where})`);
        if (MATERIAL_CODE_BY_ID[part.materialId] == undefined)
            throw new Error(`Composition pre-encoding failed :: Unknown materialId "${part.materialId}" (${where})`);

        const composedPart: InstancedMeshCompositionPart = {
            geometryId: part.geometryId,
            materialId: part.materialId,
            dir: part.dir,
            offset: part.offset,
            scale: part.scale,
        };

        // The Default codec only writes/reads colors for instance-colored materials.
        if (INSTANCE_COLORED_MATERIAL_IDS.includes(part.materialId))
        {
            if (part.color == undefined)
                throw new Error(`Composition pre-encoding failed :: Material "${part.materialId}" is tinted per instance and needs a color (${where})`);
            composedPart.color = resolveIndeterminateColor(part.color);
            assertColorIsInPalette(part.materialId, composedPart.color, "color", where);
        }
        // ...and mouldings only for wood.
        if (part.materialId == INSTANCED_WOOD_MATERIAL_ID)
        {
            if (part.mouldingColor == undefined || part.mouldingThickness == undefined
                || part.mouldingIsConvex == undefined)
                throw new Error(`Composition pre-encoding failed :: Material "${part.materialId}" needs mouldingColor, mouldingThickness and mouldingIsConvex (${where})`);
            if (!(part.mouldingThickness > 0))
                throw new Error(`Composition pre-encoding failed :: mouldingThickness must be positive (${where})`);
            composedPart.mouldingColor = resolveIndeterminateColor(part.mouldingColor);
            assertColorIsInPalette(part.materialId, composedPart.mouldingColor, "mouldingColor", where);
            composedPart.mouldingThickness = part.mouldingThickness;
            composedPart.mouldingIsConvex = part.mouldingIsConvex;
        }
        return composedPart;
    });
}

// Colors are stored as a position in the material's palette, so one that is not in it comes back as
// its nearest neighbour. Caught here rather than left to surprise whoever authored the entry.
function assertColorIsInPalette(materialId: string, color: Vec3, fieldName: string, where: string): void
{
    const paletteName = COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID[materialId];
    if (paletteName == undefined)
        throw new Error(`Composition pre-encoding failed :: Material "${materialId}" has no palette (${where})`);

    const snapped = ColorUtil.paletteIndexToRGB(paletteName, ColorUtil.rgbToPaletteIndex(paletteName, color));
    if (snapped.x != color.x || snapped.y != color.y || snapped.z != color.z)
        throw new Error(`Composition pre-encoding failed :: ${fieldName} is not in the "${paletteName}" palette (${where})`);
}

function resolveIndeterminateColor(color: Vec3): Vec3
{
    return {
        x: color.x == PRE_ENCODING_INDETERMINATE ? INDETERMINATE_COLOR_CHANNEL : color.x,
        y: color.y == PRE_ENCODING_INDETERMINATE ? INDETERMINATE_COLOR_CHANNEL : color.y,
        z: color.z == PRE_ENCODING_INDETERMINATE ? INDETERMINATE_COLOR_CHANNEL : color.z,
    };
}

// Leaf by leaf, copying each object it descends into, since decoded params may share constants.
function mergeAuthoredValues(target: {[key: string]: any}, authored: {[key: string]: any}): void
{
    for (const key of Object.keys(authored))
    {
        if (isRecord(authored[key]) && isRecord(target[key]))
        {
            target[key] = {...target[key]};
            mergeAuthoredValues(target[key], authored[key]);
        }
        else
            target[key] = authored[key];
    }
}

// A misspelled field decodes as missing, so it fails here too.
function assertAuthoredValuesSurvive(authored: {[key: string]: any}, decoded: {[key: string]: any} | undefined,
    path: string, where: string): void
{
    for (const key of Object.keys(authored))
    {
        const fieldPath = `${path}.${key}`;
        if (isRecord(authored[key]))
            assertAuthoredValuesSurvive(authored[key], decoded?.[key], fieldPath, where);
        else if (decoded?.[key] !== authored[key])
            throw new Error(`Composition pre-encoding failed :: ${fieldPath} is ${JSON.stringify(authored[key])} but decodes as ${JSON.stringify(decoded?.[key])} (${where})`);
    }
}

function isRecord(value: any): value is {[key: string]: any}
{
    return typeof value == "object" && value != null && !Array.isArray(value);
}
