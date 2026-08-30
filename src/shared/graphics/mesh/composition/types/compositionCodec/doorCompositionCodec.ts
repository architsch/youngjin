import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import ColorUtil from "../../../../../math/util/colorUtil";
import StringUtil from "../../../../../math/util/stringUtil";
import { DOOR_GEOMETRY_ID, INSTANCED_WOOD_MATERIAL_ID, ZERO_VEC3 } from "../../../../../system/sharedConstants";
import MeshDataUtil from "../../../util/meshDataUtil";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import DoorCompositionConstants from "../compositionConstants/doorCompositionConstants";
import DoorCompositionParams from "../compositionParams/doorCompositionParams";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// A door's appearance as an object-metadata string: one visible-ASCII character per color, over the
// one design every door is built to (see DoorCompositionConstants). Keeping the encoded form this
// small and this literal is what makes a door customizable later — a form editing these three colors
// is the whole feature, with nothing to migrate and nothing to interpret.
//
// Like the player's, this string arrives from elsewhere and is untrusted on the read side: decoding
// clamps rather than trusts, and always yields a drawable door.
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
    decode: (strToDecode: string,
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
    getRandomComposition: (seed: number):
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
    {
        const rand = new RandomNumberGenerator(seed);

        const params = getBaseParams();
        // Drawn as one finish rather than as three independent colors, so that a door nobody chose
        // the colors of still looks like a door somebody painted (see DoorCompositionConstants).
        const schemes = DoorCompositionConstants.colorSchemes;
        const scheme = schemes[rand.randomInt(0, schemes.length)];
        params.colors.panel = {...scheme.panel};
        params.colors.label = {...scheme.label};
        params.colors.knob = {...scheme.knob};

        const parts: InstancedMeshCompositionPart[] = [];
        constructParts(params, parts);
        return {params, parts};
    },
}

function decodeColor(strToDecode: string, charIndex: number)
{
    // paletteIndexToRGB clamps the position into the palette, so a hostile or truncated string
    // yields a real color rather than an undefined one.
    return ColorUtil.paletteIndexToRGB("Timber",
        StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charIndex));
}

function getBaseParams(): DoorCompositionParams
{
    // Every part of a door is a flat quad finished as moulded timber ("InstancedWood"), including
    // the knob: what distinguishes the parts is their color, how wide a moulding runs around them,
    // and whether that moulding stands proud or is sunk, none of which needs a geometry of its own.
    const ids = {
        instancedMeshId_square: MeshDataUtil.getInstancedMeshId(
            DOOR_GEOMETRY_ID, INSTANCED_WOOD_MATERIAL_ID),
    };
    const colors = {panel: ZERO_VEC3, label: ZERO_VEC3, knob: ZERO_VEC3};
    return {ids, colors};
}

function constructParts(params: DoorCompositionParams,
    parts: InstancedMeshCompositionPart[])
{
    InstancedMeshCompositionBuilderMap["DoorPanel_0"](params, parts).run();
}
