import Vec3 from "../../../../../math/types/vec3";
import ColorUtil from "../../../../../math/util/colorUtil";
import DirUtil from "../../../../../math/util/dirUtil";
import Geometry3DUtil from "../../../../../math/util/geometry3DUtil";
import NumUtil from "../../../../../math/util/numUtil";
import StringUtil from "../../../../../math/util/stringUtil";
import Vector3DUtil from "../../../../../math/util/vector3DUtil";
import { COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID, DIR_VEC_BY_CODE, GEOMETRY_CODE_BY_ID,
    GEOMETRY_ID_BY_CODE, INSTANCED_WOOD_MATERIAL_ID, MATERIAL_CODE_BY_ID, MATERIAL_ID_BY_CODE,
    RELIEF_STEP } from "../../../../../system/sharedConstants";
import MouldingCompositionConstants from "../compositionConstants/mouldingCompositionConstants";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// Spells out arbitrary parts, one fixed-width word each and no separator: the first char names the
// material, which fixes how many chars follow. A part is its geometry and material, its facing, its
// offset and scale, then the color if the material is instance-colored, then the moulding (color,
// band width, proud/sunk) if it is wood.
//
// Offsets and scales are quantized to the steps the game authors on, so a value on the grid survives
// a round trip exactly. Each reaches 94 steps from its minimum, the alphabet's width.
const OFFSET_STEP = 0.0625;
const OFFSET_MIN = -2.9375;
const SCALE_STEP = 0.125;
const SCALE_MIN = -5.875;

// Material codes share a char with the geometry code, which caps them at 3 bits.
const MATERIAL_CODE_RADIX = 8;

const MOULDING_CONVEX_FLAG = 1;

// Records on a decoded part how much relief it was given, so encoding can take exactly that back off.
const RELIEF_LAYER_KEY = "reliefLayer";

const CHARS_PER_PART = 8; // geometry + material, dir, offset (3), scale (3)
const CHARS_PER_COLOR = 1;
const CHARS_PER_MOULDING = 2; // color, then the flags and band width

export const DefaultCompositionCodec: InstancedMeshCompositionCodec = {
    encode: (params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]): string =>
    {
        const partChars: string[] = [];
        for (let i = 0; i < parts.length; ++i)
        {
            const part = parts[i];
            // Relief a decode added is taken back off rather than stored: it is finer than the offset
            // grid, so storing it would round up and push a stack further out on every round trip.
            // Parts that never went through a decode carry no relief and are written as authored.
            const offset = (part[RELIEF_LAYER_KEY] > 0)
                ? Vector3DUtil.subtract(part.offset, getReliefOffset(part.dir, part[RELIEF_LAYER_KEY]))
                : part.offset;
            const geometryCode = GEOMETRY_CODE_BY_ID[part.geometryId];
            const materialCode = MATERIAL_CODE_BY_ID[part.materialId];
            if (geometryCode == undefined || materialCode == undefined)
            {
                console.error(`DefaultCompositionCodec::encode :: Part has no code (geometryId = ${part.geometryId}, materialId = ${part.materialId})`);
                continue;
            }
            const head = geometryCode * MATERIAL_CODE_RADIX + materialCode;
            if (head > 93)
            {
                console.error(`DefaultCompositionCodec::encode :: Geometry and material do not fit one char (geometryId = ${part.geometryId}, materialId = ${part.materialId})`);
                continue;
            }

            partChars.push(StringUtil.convertRawNumberToVisibleASCII(head));
            partChars.push(StringUtil.convertRawNumberToVisibleASCII(DirUtil.dirVecToCode(part.dir)));
            partChars.push(encodeOnGrid(offset.x, OFFSET_MIN, OFFSET_STEP));
            partChars.push(encodeOnGrid(offset.y, OFFSET_MIN, OFFSET_STEP));
            partChars.push(encodeOnGrid(offset.z, OFFSET_MIN, OFFSET_STEP));
            partChars.push(encodeOnGrid(part.scale.x, SCALE_MIN, SCALE_STEP));
            partChars.push(encodeOnGrid(part.scale.y, SCALE_MIN, SCALE_STEP));
            partChars.push(encodeOnGrid(part.scale.z, SCALE_MIN, SCALE_STEP));

            const paletteName = COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID[part.materialId];
            if (paletteName != undefined)
                partChars.push(encodeColor(paletteName, part.color!));
            if (part.materialId == INSTANCED_WOOD_MATERIAL_ID)
            {
                partChars.push(encodeColor(paletteName, part.mouldingColor ?? part.color!));
                const flags = part.mouldingIsConvex ? MOULDING_CONVEX_FLAG : 0;
                partChars.push(StringUtil.convertRawNumberToVisibleASCII(
                    flags * MouldingCompositionConstants.numThicknessSteps
                        + MouldingCompositionConstants.toThicknessStep(part.mouldingThickness!)));
            }
        }
        return partChars.join("");
    },
    decode: (strToDecode: string,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]): void =>
    {
        // Parts are appended, so the relief pass below must know where this call's own start.
        const firstDecodedIndex = decodedParts.length;

        let charOffset = 2; // First two chars are for the codec's type and version, respectively.
        while (charOffset < strToDecode.length)
        {
            const head = StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset);
            const geometryId = GEOMETRY_ID_BY_CODE[Math.floor(head / MATERIAL_CODE_RADIX)];
            const materialId = MATERIAL_ID_BY_CODE[head % MATERIAL_CODE_RADIX];
            // Without a material there is no way to tell where this part ends, so the rest is lost.
            if (!geometryId || !materialId)
                break;

            const paletteName = COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID[materialId];
            let charsInPart = CHARS_PER_PART;
            if (paletteName != undefined)
                charsInPart += CHARS_PER_COLOR;
            if (materialId == INSTANCED_WOOD_MATERIAL_ID)
                charsInPart += CHARS_PER_MOULDING;
            if (charOffset + charsInPart > strToDecode.length)
                break; // A part cut short by truncation is dropped rather than half-read.

            ++charOffset;
            const dir = {...DIR_VEC_BY_CODE[
                StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++) % DIR_VEC_BY_CODE.length]};
            const offset: Vec3 = {
                x: decodeOnGrid(strToDecode, charOffset++, OFFSET_MIN, OFFSET_STEP),
                y: decodeOnGrid(strToDecode, charOffset++, OFFSET_MIN, OFFSET_STEP),
                z: decodeOnGrid(strToDecode, charOffset++, OFFSET_MIN, OFFSET_STEP),
            };
            const scale: Vec3 = {
                x: decodeOnGrid(strToDecode, charOffset++, SCALE_MIN, SCALE_STEP),
                y: decodeOnGrid(strToDecode, charOffset++, SCALE_MIN, SCALE_STEP),
                z: decodeOnGrid(strToDecode, charOffset++, SCALE_MIN, SCALE_STEP),
            };

            const part: InstancedMeshCompositionPart = {geometryId, materialId, dir, offset, scale};
            if (paletteName != undefined)
                part.color = decodeColor(paletteName, strToDecode, charOffset++);
            if (materialId == INSTANCED_WOOD_MATERIAL_ID)
            {
                part.mouldingColor = decodeColor(paletteName, strToDecode, charOffset++);
                const moulding = StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++);
                const numSteps = MouldingCompositionConstants.numThicknessSteps;
                part.mouldingIsConvex = (Math.floor(moulding / numSteps) & MOULDING_CONVEX_FLAG) != 0;
                part.mouldingThickness = MouldingCompositionConstants.fromThicknessStep(moulding % numSteps);
            }
            decodedParts.push(part);
        }

        applySquareRelief(decodedParts, firstDecodedIndex);
    },
    getRandomComposition: (seed: number):
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
    {
        throw new Error("DefaultCompositionCodec::getRandomComposition : NOT IMPLEMENTED");
    },
    getStructuralVariants: (): string[] =>
    {
        // Spells out arbitrary parts, so no set of variants bounds it.
        throw new Error("DefaultCompositionCodec::getStructuralVariants : NOT IMPLEMENTED");
    },
}

// Quantized on the step rather than across the range: min and step are exact binary fractions, so a
// value already on the grid survives the round trip bit for bit, which spreading 94 levels over the
// range does not.
function encodeOnGrid(value: number, min: number, step: number): string
{
    const raw = Math.round((value - min) / step);
    if (!Number.isFinite(raw))
        return StringUtil.convertRawNumberToVisibleASCII(0);
    if (raw < 0 || raw > 93)
        console.error(`DefaultCompositionCodec::encode :: Value is outside the range it is stored in (value = ${value}, min = ${min}, step = ${step})`);
    return StringUtil.convertRawNumberToVisibleASCII(NumUtil.clampInRange(raw, 0, 93));
}

function decodeOnGrid(strToDecode: string, charIndex: number, min: number, step: number): number
{
    return min + StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charIndex) * step;
}

function encodeColor(paletteName: string, color: Vec3): string
{
    return StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex(paletteName, color));
}

function decodeColor(paletteName: string, strToDecode: string, charIndex: number): Vec3
{
    // paletteIndexToRGB clamps, so bad input still yields a real color.
    return ColorUtil.paletteIndexToRGB(paletteName,
        StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charIndex));
}

// How many relief steps each part stands off whatever it covers: a square laid over another square it
// overlaps is lifted clear of it, so the two don't z-fight. Non-squares get 0. Stored offsets cannot
// express this (a step is finer than the offset grid), and a composition that spelled it out would
// have to be re-authored whenever a part was inserted beneath another.
//
// Depth along dir is not read, so this gives the same answer before and after the relief is applied.
function getSquareReliefLayers(parts: InstancedMeshCompositionPart[], firstIndex: number): number[]
{
    const layers: number[] = new Array<number>(parts.length).fill(0);
    const squareIndices: number[] = [];

    for (let i = firstIndex; i < parts.length; ++i)
    {
        const part = parts[i];
        if (part.geometryId != "Square")
            continue;

        layers[i] = 1;
        // Parts are drawn in order, so the nearest earlier square this one covers is what it sits on.
        for (let j = squareIndices.length - 1; j >= 0; --j)
        {
            const below = parts[squareIndices[j]];
            if (Vector3DUtil.equal(part.dir, below.dir)
                && Geometry3DUtil.squaresOverlap(
                    part.offset, part.scale, below.offset, below.scale, part.dir))
            {
                layers[i] = layers[squareIndices[j]] + 1;
                break;
            }
        }
        squareIndices.push(i);
    }
    return layers;
}

function getReliefOffset(dir: Vec3, layer: number): Vec3
{
    return Vector3DUtil.scale(Vector3DUtil.normalize(dir), RELIEF_STEP * layer);
}

function applySquareRelief(parts: InstancedMeshCompositionPart[], firstIndex: number): void
{
    const layers = getSquareReliefLayers(parts, firstIndex);
    for (let i = firstIndex; i < parts.length; ++i)
    {
        if (layers[i] == 0)
            continue;
        parts[i].offset = Vector3DUtil.add(parts[i].offset, getReliefOffset(parts[i].dir, layers[i]));
        parts[i][RELIEF_LAYER_KEY] = layers[i];
    }
}
