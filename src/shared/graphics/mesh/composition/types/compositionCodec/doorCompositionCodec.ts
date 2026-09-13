import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import ColorUtil from "../../../../../math/util/colorUtil";
import StringUtil from "../../../../../math/util/stringUtil";
import { INSTANCED_WOOD_MATERIAL_ID, ZERO_VEC3 } from "../../../../../system/sharedConstants";
import MeshDataUtil from "../../../util/meshDataUtil";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import DoorCompositionConstants, { DOOR_GEOMETRY_ID } from "../compositionConstants/doorCompositionConstants";
import DoorCompositionParams from "../compositionParams/doorCompositionParams";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// Door appearance: one visible-ASCII char per color (timber, plate, knob) over the single door design
// (see DoorCompositionConstants). Untrusted on read: decoding clamps and always yields a drawable door.
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
        // Default finishes come from coordinated schemes (see DoorCompositionConstants).
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
    // paletteIndexToRGB clamps, so bad input still yields a real color.
    return ColorUtil.paletteIndexToRGB("Timber",
        StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charIndex));
}

function getBaseParams(): DoorCompositionParams
{
    // Every part (knob included) is a moulded-timber quad; parts differ only in color and moulding.
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
