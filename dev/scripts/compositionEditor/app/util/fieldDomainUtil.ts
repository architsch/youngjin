import { InstancedMeshCompositionCodecMap } from "../../../../../src/shared/graphics/mesh/composition/maps/instancedMeshCompositionCodecMap";
import { DefaultCompositionCodec } from "../../../../../src/shared/graphics/mesh/composition/types/compositionCodec/defaultCompositionCodec";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../../../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import CompositionMetadataUtil from "../../../../../src/shared/graphics/mesh/composition/util/compositionMetadataUtil";
import ColorUtil from "../../../../../src/shared/math/util/colorUtil";
import StringUtil from "../../../../../src/shared/math/util/stringUtil";
import { COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID, GEOMETRY_ID_BY_CODE,
    UNIT_VEC3 } from "../../../../../src/shared/system/sharedConstants";
import CodecField from "../types/codecField";

// What each authored field can hold, read off the codec rather than restated: every char of a canonical
// encoding is swept through the whole alphabet and decoded, and each leaf records what it came back as. A
// vector with components that one char moves together (a palette color, a facing) is chosen whole.
const ALPHABET_SIZE = 94;

const fieldsByParamsCodec: {[key: string]: CodecField[]} = {};
const fieldsByPartMaterial: {[materialId: string]: CodecField[]} = {};
const defaultPartByMaterial: {[materialId: string]: InstancedMeshCompositionPart} = {};

const FieldDomainUtil =
{
    // A params codec's fields, with what it reads when the entry leaves each out. Empty for the Default codec.
    getParamsFields: (codecType: string, codecVersion: number): CodecField[] =>
    {
        const key = `${codecType}:${codecVersion}`;
        if (fieldsByParamsCodec[key] == undefined)
        {
            try
            {
                fieldsByParamsCodec[key] = probeParamsFields(codecType, codecVersion);
            }
            catch (err)
            {
                // Left to the entry's JSON, which the encoder still checks.
                console.warn(`FieldDomainUtil :: Could not read the fields of codec "${codecType}"`, err);
                fieldsByParamsCodec[key] = [];
            }
        }
        return fieldsByParamsCodec[key];
    },

    // A spelled-out part's fields for its material, other than its geometry and material.
    getPartFields: (materialId: string): CodecField[] =>
    {
        return fieldsByPartMaterial[materialId] ??= probeFields(
            CompositionMetadataUtil.getCodecPrefix(InstancedMeshCompositionCodecTypeEnumMap.Default, 0),
            DefaultCompositionCodec.encode({}, [getDefaultPart(materialId)]),
            decodeFirstPart,
            1); // The head char names the geometry and material, which set the part's length.
    },

    // The plainest part of a material: every field the material has, at its first stored value.
    getDefaultPart: (materialId: string, geometryId: string): InstancedMeshCompositionPart =>
    {
        return {...getDefaultPart(materialId), geometryId};
    },
}

export default FieldDomainUtil;

function probeParamsFields(codecType: string, codecVersion: number): CodecField[]
{
    const codecTypeValue = InstancedMeshCompositionCodecTypeEnumMap[codecType];
    const codec = InstancedMeshCompositionCodecMap[codecTypeValue];
    if (codec == undefined || codecTypeValue == InstancedMeshCompositionCodecTypeEnumMap.Default)
        return [];

    const prefix = CompositionMetadataUtil.getCodecPrefix(codecTypeValue, codecVersion);
    const decode = (str: string) => {
        const params = {};
        codec.decode(str, UNIT_VEC3, params, []);
        return params;
    };
    return probeFields(prefix, codec.encode(decode(prefix), []), decode, 0);
}

// Encoding pads what a part leaves out, so a part given every field comes back with just its material's.
function getDefaultPart(materialId: string): InstancedMeshCompositionPart
{
    if (defaultPartByMaterial[materialId] == undefined)
    {
        const candidates = GEOMETRY_ID_BY_CODE.map(geometryId => roundTripPart(getFullPart(materialId, geometryId)));
        defaultPartByMaterial[materialId] = candidates.find(part => part.offset.z == 0) ?? candidates[0];
    }
    return defaultPartByMaterial[materialId];
}

// Every field a part of any material can have. Decoding lifts some geometries off what they cover
// (squares), which would read as a changed offset, so the probe is made of one it leaves in place.
function getFullPart(materialId: string, geometryId: string): InstancedMeshCompositionPart
{
    const paletteName = COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID[materialId];
    const color = paletteName ? ColorUtil.paletteIndexToRGB(paletteName, 0) : {x: 0, y: 0, z: 0};
    return {geometryId, materialId, dir: {x: 0, y: 0, z: 1}, offset: {x: 0, y: 0, z: 0},
        scale: {x: 1, y: 1, z: 1}, color, mouldingColor: color, mouldingThickness: 0, mouldingIsConvex: false};
}

function roundTripPart(part: InstancedMeshCompositionPart): InstancedMeshCompositionPart
{
    return decodeFirstPart(CompositionMetadataUtil.getCodecPrefix(InstancedMeshCompositionCodecTypeEnumMap.Default, 0)
        + DefaultCompositionCodec.encode({}, [part]));
}

function decodeFirstPart(str: string): InstancedMeshCompositionPart
{
    const parts: InstancedMeshCompositionPart[] = [];
    DefaultCompositionCodec.decode(str, UNIT_VEC3, {}, parts);
    return parts[0];
}

// The sweep feeds chars no real encoding holds, which decoding clamps and logs.
function probeFields(prefix: string, body: string, decode: (str: string) => any, firstCharIndex: number): CodecField[]
{
    const {warn, error} = console;
    console.warn = console.error = () => {};
    try
    {
        return sweepFields(prefix, body, decode, firstCharIndex);
    }
    finally
    {
        console.warn = warn;
        console.error = error;
    }
}

function sweepFields(prefix: string, body: string, decode: (str: string) => any, firstCharIndex: number): CodecField[]
{
    const base = decode(prefix + body);
    const baseLeaves = flattenLeaves(base);
    const samplesByPath: {[path: string]: any[]} = {};
    const wholeVectorPaths = new Set<string>();

    for (let charIndex = firstCharIndex; charIndex < body.length; ++charIndex)
    {
        const decodedList: any[] = [];
        const changedPaths = new Set<string>();
        for (let raw = 0; raw < ALPHABET_SIZE; ++raw)
        {
            const decoded = decode(prefix + body.slice(0, charIndex)
                + StringUtil.convertRawNumberToVisibleASCII(raw) + body.slice(charIndex + 1));
            decodedList.push(decoded);
            for (const [path, value] of Object.entries(flattenLeaves(decoded)))
            {
                if (value !== baseLeaves[path])
                    changedPaths.add(path);
            }
        }

        const changedCountByParent: {[parentPath: string]: number} = {};
        for (const path of changedPaths)
        {
            const parentPath = getParentPath(path);
            changedCountByParent[parentPath] = (changedCountByParent[parentPath] ?? 0) + 1;
        }
        for (const path of changedPaths)
        {
            const parentPath = getParentPath(path);
            const fieldPath = (isVector(getAt(base, parentPath)) && changedCountByParent[parentPath] > 1)
                ? parentPath : path;
            if (fieldPath != path)
                wholeVectorPaths.add(fieldPath);
            const samples = samplesByPath[fieldPath] ??= [];
            for (const decoded of decodedList)
                samples.push(getAt(decoded, fieldPath));
        }
    }

    // In the order the codec decodes them, which is the order the source spells them.
    const orderedPaths = Object.keys(baseLeaves)
        .map(path => wholeVectorPaths.has(getParentPath(path)) ? getParentPath(path) : path)
        .filter((path, i, paths) => samplesByPath[path] != undefined && paths.indexOf(path) == i);

    return orderedPaths.map((path): CodecField => {
        const defaultValue = getAt(base, path);
        // In the order the chars run, which is palette order for a color.
        const samples = [...samplesByPath[path], defaultValue];
        if (typeof defaultValue == "boolean")
            return {path, domain: {kind: "boolean"}, defaultValue};
        if (typeof defaultValue == "number")
        {
            const values = [...new Set<number>(samples)].sort((a, b) => a - b);
            return {path, domain: {kind: "number", values}, defaultValue};
        }
        const options = [...new Map(samples.map(sample => [JSON.stringify(sample), sample])).values()];
        return {path, domain: {kind: "choice", options}, defaultValue};
    });
}

// Dotted paths to every primitive, e.g. {"colors.frame.x": 201, "framed": true}.
function flattenLeaves(value: any, prefix: string = "", leaves: {[path: string]: any} = {}): {[path: string]: any}
{
    if (value != undefined && typeof value == "object")
    {
        for (const key of Object.keys(value))
            flattenLeaves(value[key], prefix ? `${prefix}.${key}` : key, leaves);
    }
    else if (prefix)
        leaves[prefix] = value;
    return leaves;
}

function getAt(value: any, dottedPath: string): any
{
    if (dottedPath == "")
        return value;
    return dottedPath.split(".").reduce((node, key) => node?.[key], value);
}

function getParentPath(dottedPath: string): string
{
    const lastDot = dottedPath.lastIndexOf(".");
    return lastDot < 0 ? "" : dottedPath.slice(0, lastDot);
}

function isVector(value: any): boolean
{
    return value != undefined && typeof value == "object"
        && Object.keys(value).sort().join() == "x,y,z";
}
