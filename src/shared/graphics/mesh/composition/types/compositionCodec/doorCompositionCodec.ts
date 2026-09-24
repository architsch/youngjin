import Vec3 from "../../../../../math/types/vec3";
import ColorUtil from "../../../../../math/util/colorUtil";
import StringUtil from "../../../../../math/util/stringUtil";
import { ZERO_VEC3 } from "../../../../../system/sharedConstants";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import DoorCompositionParams from "../compositionParams/doorCompositionParams";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// Door appearance: one visible-ASCII char per color (timber, plate, knob) over the single door design
// (see DoorCompositionConstants). Doors store only an index to one of these (see IndexedCompositionCodec).
// Untrusted on read: decoding clamps and always yields a drawable door.
export const DoorCompositionCodec: InstancedMeshCompositionCodec = {
    encode: (params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]): string =>
    {
        const arr: string[] = [];
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Timber", params.colors.panel)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Timber", params.colors.label)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Timber", params.colors.knob)));
        return arr.join("");
    },
    decode: (strToDecode: string, objectSize: Vec3,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]): void =>
    {
        let charOffset = 2; // First two chars are for the codec's type and version, respectively.
        Object.assign(decodedParams, getBaseParams()); // Filled in place, so that the caller's params object gets updated.
        decodedParams.colors.panel = decodeColor(strToDecode, charOffset++);
        decodedParams.colors.label = decodeColor(strToDecode, charOffset++);
        decodedParams.colors.knob = decodeColor(strToDecode, charOffset++);
        constructParts(decodedParams, decodedParts);
    },
    getRandomComposition: (seed: number, objectSize: Vec3):
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
    {
        // Its looks are authored ones, and a seeded default is one of those (see CompositionMetadataUtil).
        throw new Error("DoorCompositionCodec::getRandomComposition : NOT IMPLEMENTED");
    },
    getStructuralVariants: (): string[] =>
    {
        // Reached only through pre-encoded entries, which are its variants (see InstancedMeshCapacityBuilder).
        throw new Error("DoorCompositionCodec::getStructuralVariants : NOT IMPLEMENTED");
    },
}

function decodeColor(strToDecode: string, charIndex: number)
{
    // paletteIndexToRGB clamps, so bad input still yields a real color.
    return ColorUtil.paletteIndexToRGB("Timber",
        StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charIndex));
}

function getBaseParams(): DoorCompositionParams
{
    const colors = {panel: ZERO_VEC3, label: ZERO_VEC3, knob: ZERO_VEC3};
    return {colors};
}

function constructParts(params: DoorCompositionParams,
    parts: InstancedMeshCompositionPart[])
{
    InstancedMeshCompositionBuilderMap["DoorPanel_0"](params, parts).run();
}
