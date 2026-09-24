import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import Vec3 from "../../../../../math/types/vec3";
import ColorUtil from "../../../../../math/util/colorUtil";
import StringUtil from "../../../../../math/util/stringUtil";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import FramedPanelCompositionConstants from "../compositionConstants/framedPanelCompositionConstants";
import MarginCompositionConstants from "../compositionConstants/marginCompositionConstants";
import MouldingCompositionConstants from "../compositionConstants/mouldingCompositionConstants";
import FramedPanelCompositionParams from "../compositionParams/framedPanelCompositionParams";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import FramedPanelCodecStyle from "./framedPanelCodecStyle";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// A framed panel's look (canvases, labels), one visible-ASCII char each: its colors as palette
// positions, in the style's slot order; the band width (a step; see MouldingCompositionConstants); a flags
// char holding the profile (proud or sunk) and whether the frame is shown; and the margin (a step; see
// MarginCompositionConstants), last so a string written before it existed reads as none. A panel without a
// frame still stores its finish, so turning the frame back on restores it. Untrusted on read: decoding
// clamps and always yields a drawable panel.
const CONVEX_FLAG = 1;
const FRAMED_FLAG = 2;

export default function createFramedPanelCodec(style: FramedPanelCodecStyle): InstancedMeshCompositionCodec
{
    const codec: InstancedMeshCompositionCodec = {
        encode: (params: InstancedMeshCompositionParams,
            parts: InstancedMeshCompositionPart[]): string =>
        {
            const arr: string[] = [];
            for (const slot of style.colorSlots)
                arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Timber", params.colors[slot])));
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
            const base = getBaseParams(style);
            Object.assign(decodedParams, base); // Filled in place, so that the caller's params object gets updated.
            if (strToDecode.length > charOffset)
            {
                for (const slot of style.colorSlots)
                {
                    // paletteIndexToRGB clamps, so bad input still yields a real color.
                    decodedParams.colors[slot] = ColorUtil.paletteIndexToRGB("Timber",
                        StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
                }
                decodedParams.mouldingThickness = MouldingCompositionConstants.fromThicknessStep(
                    StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
                const flagsWhenMissing = (base.mouldingIsConvex ? CONVEX_FLAG : 0)
                    | (style.framedWhenFlagsMissing ? FRAMED_FLAG : 0);
                const flags = StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++, flagsWhenMissing);
                decodedParams.mouldingIsConvex = (flags & CONVEX_FLAG) != 0;
                decodedParams.framed = (flags & FRAMED_FLAG) != 0;
                decodedParams.margin = MarginCompositionConstants.fromMarginStep(
                    StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++, 0));
            }
            constructParts(style, decodedParams, decodedParts, objectSize);
        },
        getRandomComposition: (seed: number, objectSize: Vec3):
            {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
        {
            const rand = new RandomNumberGenerator(seed);
            const params = getBaseParams(style);
            FramedPanelCompositionConstants.applyPreset(params,
                style.presets[rand.randomInt(0, style.presets.length)]);
            if (style.framedByDefault)
                params.framed = true;

            const parts: InstancedMeshCompositionPart[] = [];
            constructParts(style, params, parts, objectSize);
            return {params, parts};
        },
        getStructuralVariants: (): string[] =>
        {
            // Only the frame flag decides which parts are built.
            return [false, true].map(framed => codec.encode({...getBaseParams(style), framed}, []));
        },
    };
    return codec;
}

// The first preset, unframed with no margin where it doesn't say, so a frame turned on has a real finish to
// come back with. A fresh copy, so edits to the result don't reach the preset.
function getBaseParams(style: FramedPanelCodecStyle): FramedPanelCompositionParams
{
    const params: FramedPanelCompositionParams = {colors: {frame: {x: 0, y: 0, z: 0}},
        mouldingThickness: 0, mouldingIsConvex: false, framed: false, margin: 0};
    FramedPanelCompositionConstants.applyPreset(params, style.presets[0]);
    return params;
}

function constructParts(style: FramedPanelCodecStyle, params: FramedPanelCompositionParams,
    parts: InstancedMeshCompositionPart[], objectSize: Vec3)
{
    InstancedMeshCompositionBuilderMap[style.builderId](params, parts, objectSize).run();
}
