import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import Vec3 from "../../../../../math/types/vec3";
import ColorUtil from "../../../../../math/util/colorUtil";
import StringUtil from "../../../../../math/util/stringUtil";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import CanvasCompositionConstants from "../compositionConstants/canvasCompositionConstants";
import MarginCompositionConstants from "../compositionConstants/marginCompositionConstants";
import MouldingCompositionConstants from "../compositionConstants/mouldingCompositionConstants";
import CanvasCompositionParams from "../compositionParams/canvasCompositionParams";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// Canvas appearance: one visible-ASCII char each for the frame color, inner color (palette positions),
// band width (a step; see MouldingCompositionConstants), a flags char holding the profile (proud or sunk)
// and whether the frame is shown, and the margin (a step; see MarginCompositionConstants), last so a
// string written before it existed reads as none. A canvas without a frame still stores its finish, so
// turning the frame back on restores it. Untrusted on read: decoding clamps and always yields a drawable
// canvas.
const CONVEX_FLAG = 1;
const FRAMED_FLAG = 2;

export const CanvasCompositionCodec: InstancedMeshCompositionCodec = {
    encode: (params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]): string =>
    {
        const arr: string[] = [];
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Timber", params.colors.frame)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Timber", params.colors.inner)));
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
        Object.assign(decodedParams, getBaseParams()); // Filled in place, so that the caller's params object gets updated.
        if (strToDecode.length > charOffset)
        {
            decodedParams.colors.frame = decodeColor(strToDecode, charOffset++);
            decodedParams.colors.inner = decodeColor(strToDecode, charOffset++);
            decodedParams.mouldingThickness = MouldingCompositionConstants.fromThicknessStep(
                StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
            // A string cut before the flags keeps its frame.
            const flags = StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++, FRAMED_FLAG);
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
        constructParts(params, parts, objectSize);
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

function getBaseParams(): CanvasCompositionParams
{
    // Frameless when nothing is stored, but with a real finish for the frame to come back with.
    const preset = CanvasCompositionConstants.presets[0];
    const colors = {frame: {...preset.colors.frame}, inner: {...preset.colors.inner}};
    return {colors, mouldingThickness: preset.mouldingThickness,
        mouldingIsConvex: preset.mouldingIsConvex, framed: false, margin: 0};
}

function constructParts(params: CanvasCompositionParams,
    parts: InstancedMeshCompositionPart[], objectSize: Vec3)
{
    InstancedMeshCompositionBuilderMap["CanvasFrame_0"](params, parts, objectSize).run();
}
