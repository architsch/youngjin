import Vec3 from "../../../../../math/types/vec3";
import ColorUtil from "../../../../../math/util/colorUtil";
import StringUtil from "../../../../../math/util/stringUtil";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import MouldingCompositionConstants from "../compositionConstants/mouldingCompositionConstants";
import FramedPanelCompositionParams from "../compositionParams/framedPanelCompositionParams";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// A framed panel's look (canvases, labels), one visible-ASCII char each: the frame and inner colors as
// palette positions, the band width (a step; see MouldingCompositionConstants), and a flags char holding
// the profile (proud or sunk) and whether the frame is shown. Objects store only an index to one of these
// (see IndexedCompositionCodec). Untrusted on read: decoding clamps and always yields a drawable panel.
const CONVEX_FLAG = 1;
const FRAMED_FLAG = 2;

export const FramedPanelCompositionCodec: InstancedMeshCompositionCodec = {
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
        return arr.join("");
    },
    decode: (strToDecode: string, objectSize: Vec3,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]): void =>
    {
        let charOffset = 2; // First two chars are for the codec's type and version, respectively.
        // paletteIndexToRGB clamps, so bad input still yields a real color.
        const frame = ColorUtil.paletteIndexToRGB("Timber", StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
        const inner = ColorUtil.paletteIndexToRGB("Timber", StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
        const mouldingThickness = MouldingCompositionConstants.fromThicknessStep(
            StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
        const flags = StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++);
        const params: FramedPanelCompositionParams = {colors: {frame, inner}, mouldingThickness,
            mouldingIsConvex: (flags & CONVEX_FLAG) != 0, framed: (flags & FRAMED_FLAG) != 0};
        Object.assign(decodedParams, params); // Filled in place, so that the caller's params object gets updated.
        InstancedMeshCompositionBuilderMap["PanelBoard_0"](decodedParams, decodedParts, objectSize).run();
    },
    getRandomComposition: (seed: number, objectSize: Vec3):
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
    {
        // Its looks are authored ones, and a seeded default is one of those (see CompositionMetadataUtil).
        throw new Error("FramedPanelCompositionCodec::getRandomComposition : NOT IMPLEMENTED");
    },
    getStructuralVariants: (): string[] =>
    {
        // Reached only through pre-encoded entries, which are its variants (see InstancedMeshCapacityBuilder).
        throw new Error("FramedPanelCompositionCodec::getStructuralVariants : NOT IMPLEMENTED");
    },
}
