import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import ColorUtil from "../../../../../math/util/colorUtil";
import NumUtil from "../../../../../math/util/numUtil";
import StringUtil from "../../../../../math/util/stringUtil";
import { INSTANCED_WOOD_MATERIAL_ID } from "../../../../../system/sharedConstants";
import MeshDataUtil from "../../../util/meshDataUtil";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import CanvasCompositionConstants, { CANVAS_GEOMETRY_ID } from "../compositionConstants/canvasCompositionConstants";
import CanvasCompositionParams from "../compositionParams/canvasCompositionParams";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// Canvas appearance: one visible-ASCII char each for the frame color, inner color (palette positions),
// band width (a step; see CanvasCompositionConstants), and a flags char holding the profile (proud or sunk)
// and whether the frame is shown. A canvas without a frame still stores its finish, so turning the frame
// back on restores it. Untrusted on read: decoding clamps and always yields a drawable canvas.
const CONVEX_FLAG = 1;
const FRAMED_FLAG = 2;

export const CanvasCompositionCodec: InstancedMeshCompositionCodec = {
    encode: (params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]): string =>
    {
        const arr: string[] = [];
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Timber", params.colors.frame)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Timber", params.colors.inner)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(toThicknessStep(params.mouldingThickness)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(
            (params.mouldingIsConvex ? CONVEX_FLAG : 0) | (params.framed ? FRAMED_FLAG : 0)));
        return arr.join("");
    },
    decode: (strToDecode: string,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]): void =>
    {
        let charOffset = 2; // First two chars are for the codec's type and version, respectively.
        Object.assign(decodedParams, getBaseParams()); // Filled in place, so that the caller's params object gets updated.
        if (strToDecode.length > charOffset)
        {
            decodedParams.colors.frame = decodeColor(strToDecode, charOffset++);
            decodedParams.colors.inner = decodeColor(strToDecode, charOffset++);
            decodedParams.mouldingThickness = fromThicknessStep(
                StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
            // A string cut before the flags keeps its frame.
            const flags = StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++, FRAMED_FLAG);
            decodedParams.mouldingIsConvex = (flags & CONVEX_FLAG) != 0;
            decodedParams.framed = (flags & FRAMED_FLAG) != 0;
        }
        constructParts(decodedParams, decodedParts);
    },
    getRandomComposition: (seed: number):
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
    {
        const rand = new RandomNumberGenerator(seed);

        const params = getBaseParams();
        // Default finishes come from authored presets (see CanvasCompositionConstants).
        const presets = CanvasCompositionConstants.presets;
        const preset = presets[rand.randomInt(0, presets.length)];
        params.colors.frame = {...preset.colors.frame};
        params.colors.inner = {...preset.colors.inner};
        params.mouldingThickness = preset.mouldingThickness;
        params.mouldingIsConvex = preset.mouldingIsConvex;
        params.framed = true;

        const parts: InstancedMeshCompositionPart[] = [];
        constructParts(params, parts);
        return {params, parts};
    },
    getStructuralVariants: (): string[] =>
    {
        // Only the frame flag decides whether the board is built.
        return [false, true].map(framed =>
            CanvasCompositionCodec.encode({...getBaseParams(), framed}, []));
    },
}

function decodeColor(strToDecode: string, charIndex: number)
{
    // paletteIndexToRGB clamps, so bad input still yields a real color.
    return ColorUtil.paletteIndexToRGB("Timber",
        StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charIndex));
}

function getNumThicknessSteps(): number
{
    const c = CanvasCompositionConstants;
    return Math.round((c.maxMouldingThickness - c.minMouldingThickness) / c.mouldingThicknessStep) + 1;
}

function toThicknessStep(mouldingThickness: number): number
{
    const c = CanvasCompositionConstants;
    const step = Math.round((mouldingThickness - c.minMouldingThickness) / c.mouldingThicknessStep);
    return Number.isFinite(step) ? NumUtil.clampInRange(step, 0, getNumThicknessSteps() - 1) : 0;
}

// Clamped, so any char yields a band; rounded so a decoded width equals the authored one.
function fromThicknessStep(step: number): number
{
    const c = CanvasCompositionConstants;
    const clampedStep = NumUtil.clampInRange(step, 0, getNumThicknessSteps() - 1);
    return Math.round((c.minMouldingThickness + clampedStep * c.mouldingThicknessStep) * 1e6) / 1e6;
}

function getBaseParams(): CanvasCompositionParams
{
    const ids = {
        instancedMeshId_square: MeshDataUtil.getInstancedMeshId(
            CANVAS_GEOMETRY_ID, INSTANCED_WOOD_MATERIAL_ID),
    };
    // Frameless when nothing is stored, but with a real finish for the frame to come back with.
    const preset = CanvasCompositionConstants.presets[0];
    const colors = {frame: {...preset.colors.frame}, inner: {...preset.colors.inner}};
    return {ids, colors, mouldingThickness: preset.mouldingThickness,
        mouldingIsConvex: preset.mouldingIsConvex, framed: false};
}

function constructParts(params: CanvasCompositionParams,
    parts: InstancedMeshCompositionPart[])
{
    InstancedMeshCompositionBuilderMap["CanvasFrame_0"](params, parts).run();
}
