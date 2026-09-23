import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import Vec3 from "../../../../../math/types/vec3";
import ColorUtil from "../../../../../math/util/colorUtil";
import StringUtil from "../../../../../math/util/stringUtil";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import LampCompositionConstants from "../compositionConstants/lampCompositionConstants";
import MarginCompositionConstants from "../compositionConstants/marginCompositionConstants";
import MouldingCompositionConstants from "../compositionConstants/mouldingCompositionConstants";
import LampCompositionParams from "../compositionParams/lampCompositionParams";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// Lamp appearance: one visible-ASCII char each for the frame color (a palette position), band width and
// margin (steps; see MouldingCompositionConstants, MarginCompositionConstants), and a flags char holding the
// profile (proud or sunk) and whether the frame is shown. Nothing stored is the first preset. Untrusted on
// read: decoding clamps and always yields a drawable lamp.
const CONVEX_FLAG = 1;
const FRAMED_FLAG = 2;

export const LampCompositionCodec: InstancedMeshCompositionCodec = {
    encode: (params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]): string =>
    {
        const arr: string[] = [];
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Timber", params.colors.frame)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(
            MouldingCompositionConstants.toThicknessStep(params.mouldingThickness)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(
            (params.mouldingIsConvex ? CONVEX_FLAG : 0) | (params.framed ? FRAMED_FLAG : 0)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(MarginCompositionConstants.toMarginStep(params.margin)));
        return arr.join("");
    },
    decode: (strToDecode: string, objectSize: Vec3,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]): void =>
    {
        let charOffset = 2; // First two chars are for the codec's type and version, respectively.
        Object.assign(decodedParams, getPresetParams(0)); // Filled in place, so that the caller's params object gets updated.
        if (strToDecode.length > charOffset)
        {
            decodedParams.colors.frame = ColorUtil.paletteIndexToRGB("Timber",
                StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
            decodedParams.mouldingThickness = MouldingCompositionConstants.fromThicknessStep(
                StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
            const flags = StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++,
                decodedParams.mouldingIsConvex ? CONVEX_FLAG : 0);
            decodedParams.mouldingIsConvex = (flags & CONVEX_FLAG) != 0;
            decodedParams.framed = (flags & FRAMED_FLAG) != 0;
            decodedParams.margin = MarginCompositionConstants.fromMarginStep(
                StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++, 0));
        }
        constructParts(decodedParams, decodedParts, objectSize);
    },
    getRandomComposition: (seed: number, objectSize: Vec3):
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
    {
        const rand = new RandomNumberGenerator(seed);
        const params = getPresetParams(rand.randomInt(0, LampCompositionConstants.presets.length));
        const parts: InstancedMeshCompositionPart[] = [];
        constructParts(params, parts, objectSize);
        return {params, parts};
    },
    getStructuralVariants: (): string[] =>
    {
        // Only the frame flag decides whether the band is built.
        return [false, true].map(framed =>
            LampCompositionCodec.encode({...getPresetParams(0), framed}, []));
    },
}

// A copy, so edits to the result don't reach the preset.
function getPresetParams(presetIndex: number): LampCompositionParams
{
    const preset = LampCompositionConstants.presets[presetIndex];
    return {...preset, colors: {frame: {...preset.colors.frame}}};
}

function constructParts(params: LampCompositionParams,
    parts: InstancedMeshCompositionPart[], objectSize: Vec3)
{
    InstancedMeshCompositionBuilderMap["LampFrame_0"](params, parts, objectSize).run();
}
