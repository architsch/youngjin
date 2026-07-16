import RandomNumberGenerator from "../../../../../math/types/randomNumberGenerator";
import ColorUtil from "../../../../../math/util/colorUtil";
import NumUtil from "../../../../../math/util/numUtil";
import StringUtil from "../../../../../math/util/stringUtil";
import { ZERO_VEC3 } from "../../../../../system/sharedConstants";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";
import MeshDataUtil from "../../../util/meshDataUtil";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import PlayerCompositionParams from "../compositionParams/playerCompositionParams";
import { InstancedMeshCompositionBuilderMap } from "../../maps/instancedMeshCompositionBuilderMap";
import PlayerCompositionConstants from "../compositionConstants/playerCompositionConstants";

export const PlayerCompositionCodec: InstancedMeshCompositionCodec = {
    encode: (params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]): string =>
    {   
        const arr: string[] = [];
        arr.push(StringUtil.convertRawNumberToVisibleASCII(params.types.head));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(params.types.ear));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(params.types.hat));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(params.types.torso));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(params.types.arm));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(params.types.bottom));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToBase94Index(params.colors.head)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToBase94Index(params.colors.ear)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToBase94Index(params.colors.hat)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToBase94Index(params.colors.torso)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToBase94Index(params.colors.arm)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToBase94Index(params.colors.bottom)));
        return arr.join("");
    },
    decode: (strToDecode: string,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]): void =>
    {
        let charOffset = 2; // First two chars are for the codec's type and version, respectively.
        Object.assign(decodedParams, getBaseParams()); // Filled in place, so that the caller's params object gets updated.
        decodedParams.types.head = decodePartType("head", strToDecode, charOffset++);
        decodedParams.types.ear = decodePartType("ear", strToDecode, charOffset++);
        decodedParams.types.hat = decodePartType("hat", strToDecode, charOffset++);
        decodedParams.types.torso = decodePartType("torso", strToDecode, charOffset++);
        decodedParams.types.arm = decodePartType("arm", strToDecode, charOffset++);
        decodedParams.types.bottom = decodePartType("bottom", strToDecode, charOffset++);
        decodedParams.colors.head = ColorUtil.base94IndexToRGB(StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
        decodedParams.colors.ear = ColorUtil.base94IndexToRGB(StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
        decodedParams.colors.hat = ColorUtil.base94IndexToRGB(StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
        decodedParams.colors.torso = ColorUtil.base94IndexToRGB(StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
        decodedParams.colors.arm = ColorUtil.base94IndexToRGB(StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
        decodedParams.colors.bottom = ColorUtil.base94IndexToRGB(StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
        constructParts(decodedParams, decodedParts);
    },
    getRandomComposition: (seed: number):
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
    {
        const rand = new RandomNumberGenerator(seed);

        const params = getBaseParams();
        params.types.head = rand.randomInt(0, PlayerCompositionConstants.numTypes["head"]);
        params.types.ear = rand.randomInt(0, PlayerCompositionConstants.numTypes["ear"]);
        params.types.hat = rand.randomInt(0, PlayerCompositionConstants.numTypes["hat"]);
        params.types.torso = rand.randomInt(0, PlayerCompositionConstants.numTypes["torso"]);
        params.types.arm = rand.randomInt(0, PlayerCompositionConstants.numTypes["arm"]);
        params.types.bottom = rand.randomInt(0, PlayerCompositionConstants.numTypes["bottom"]);
        params.colors.head = ColorUtil.base94IndexToRGB(rand.randomInt(0, 94));
        params.colors.ear = ColorUtil.base94IndexToRGB(rand.randomInt(0, 94));
        params.colors.hat = ColorUtil.base94IndexToRGB(rand.randomInt(0, 94));
        params.colors.torso = ColorUtil.base94IndexToRGB(rand.randomInt(0, 94));
        params.colors.arm = ColorUtil.base94IndexToRGB(rand.randomInt(0, 94));
        params.colors.bottom = ColorUtil.base94IndexToRGB(rand.randomInt(0, 94));

        const parts: InstancedMeshCompositionPart[] = [];
        constructParts(params, parts);
        return {params, parts};
    },
}

function decodePartType(partTypeName: string, strToDecode: string, charIndex: number): number
{
    return NumUtil.clampInRange(
        StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charIndex),
        0, PlayerCompositionConstants.numTypes[partTypeName] - 1);
}

function getBuilder(partName: string, partType: number)
{
    const map = InstancedMeshCompositionBuilderMap;
    return map[`${partName}_${partType}`] ?? map[`${partName}_0`];
}

function getBaseParams(): PlayerCompositionParams
{
    const ids = {
        instancedMeshId_box: MeshDataUtil.getInstancedMeshId("Box", "InstancedColor"),
        instancedMeshId_cylinder: MeshDataUtil.getInstancedMeshId("Cylinder", "InstancedColor"),
        instancedMeshId_square: MeshDataUtil.getInstancedMeshId("Square", "InstancedColor"),
    };
    const types = {head: 0, ear: 0, hat: 0, torso: 0, arm: 0, bottom: 0};
    const colors = {head: ZERO_VEC3, ear: ZERO_VEC3, hat: ZERO_VEC3, torso: ZERO_VEC3, arm: ZERO_VEC3, bottom: ZERO_VEC3};
    return {ids, types, colors};
}

function constructParts(params: PlayerCompositionParams,
    parts: InstancedMeshCompositionPart[])
{
    const map = InstancedMeshCompositionBuilderMap;

    getBuilder("PlayerHead", params.types.head)(params, parts)
        .offset(0, 6, 0).run();

    getBuilder("PlayerEar", params.types.ear)(params, parts)
        .offset(2.5, 6, 0).run();
    getBuilder("PlayerEar", params.types.ear)(params, parts)
        .offset(-2.5, 6, 0).backward().run();

    getBuilder("PlayerHat", params.types.hat)(params, parts)
        .offset(0, 9, 0).run();

    map["PlayerNeckAndWaist"](params, parts)
        .offset(0, 3.5, 0).run();

    getBuilder("PlayerTorso", params.types.torso)(params, parts)
        .offset(0, -1, 0).run();

    getBuilder("PlayerArm", params.types.arm)(params, parts)
        .offset(2.5, -1, 0).run();
    getBuilder("PlayerArm", params.types.arm)(params, parts)
        .offset(-2.5, -1, 0).backward().run();

    map["PlayerNeckAndWaist"](params, parts)
        .offset(0, -5.5, 0).run();

    getBuilder("PlayerBottom", params.types.bottom)(params, parts)
        .offset(0, -8, 0).run();
}