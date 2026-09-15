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
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Player", params.colors.head)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Player", params.colors.ear)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Player", params.colors.hat)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Player", params.colors.torso)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Player", params.colors.arm)));
        arr.push(StringUtil.convertRawNumberToVisibleASCII(ColorUtil.rgbToPaletteIndex("Player", params.colors.bottom)));
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
        decodedParams.colors.head = ColorUtil.paletteIndexToRGB("Player", StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
        decodedParams.colors.ear = ColorUtil.paletteIndexToRGB("Player", StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
        decodedParams.colors.hat = ColorUtil.paletteIndexToRGB("Player", StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
        decodedParams.colors.torso = ColorUtil.paletteIndexToRGB("Player", StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
        decodedParams.colors.arm = ColorUtil.paletteIndexToRGB("Player", StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
        decodedParams.colors.bottom = ColorUtil.paletteIndexToRGB("Player", StringUtil.convertVisibleASCIIToRawNumber(strToDecode, charOffset++));
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
        params.colors.head = ColorUtil.paletteIndexToRGB("Player", rand.randomInt(0, ColorUtil.getPaletteSize("Player")));
        params.colors.ear = ColorUtil.paletteIndexToRGB("Player", rand.randomInt(0, ColorUtil.getPaletteSize("Player")));
        params.colors.hat = ColorUtil.paletteIndexToRGB("Player", rand.randomInt(0, ColorUtil.getPaletteSize("Player")));
        params.colors.torso = ColorUtil.paletteIndexToRGB("Player", rand.randomInt(0, ColorUtil.getPaletteSize("Player")));
        params.colors.arm = ColorUtil.paletteIndexToRGB("Player", rand.randomInt(0, ColorUtil.getPaletteSize("Player")));
        params.colors.bottom = ColorUtil.paletteIndexToRGB("Player", rand.randomInt(0, ColorUtil.getPaletteSize("Player")));

        const parts: InstancedMeshCompositionPart[] = [];
        constructParts(params, parts);
        return {params, parts};
    },
    getStructuralVariants: (): string[] =>
    {
        // A slot's parts depend only on its own type, so the appearance putting the most parts in a mesh
        // takes, in each slot, the type whose own parts use that mesh the most. One variant per mesh.
        const slotNames = Object.keys(SLOT_PART_CONSTRUCTORS);

        // 1. What each type of each slot adds on its own: countsByType[type][instancedMeshId], per slot.
        const countsByTypeBySlot: {[slotName: string]: {[instancedMeshId: string]: number}[]} = {};
        const instancedMeshIds: string[] = [];
        for (const slotName of slotNames)
        {
            countsByTypeBySlot[slotName] = [];
            for (let type = 0; type < PlayerCompositionConstants.numTypes[slotName]; ++type)
            {
                const counts = countSlotPartsByMesh(slotName, type);
                countsByTypeBySlot[slotName].push(counts);
                for (const instancedMeshId in counts)
                {
                    if (!instancedMeshIds.includes(instancedMeshId))
                        instancedMeshIds.push(instancedMeshId);
                }
            }
        }

        // 2. For each mesh, every slot takes its type with the most parts in that mesh.
        const variants: string[] = [];
        for (const instancedMeshId of instancedMeshIds)
        {
            const params: InstancedMeshCompositionParams = getBaseParams();
            for (const slotName of slotNames)
            {
                const countByType = countsByTypeBySlot[slotName].map(counts => counts[instancedMeshId] ?? 0);
                params.types[slotName] = countByType.indexOf(Math.max(...countByType));
            }
            variants.push(PlayerCompositionCodec.encode(params, []));
        }
        return variants;
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

// The parts one slot adds by itself when it takes the given type.
function countSlotPartsByMesh(slotName: string, type: number): {[instancedMeshId: string]: number}
{
    const params: InstancedMeshCompositionParams = getBaseParams();
    params.types[slotName] = type;
    const parts: InstancedMeshCompositionPart[] = [];
    SLOT_PART_CONSTRUCTORS[slotName](params, parts);

    const counts: {[instancedMeshId: string]: number} = {};
    for (const part of parts)
        counts[part.instancedMeshId] = (counts[part.instancedMeshId] ?? 0) + 1;
    return counts;
}

function getBaseParams(): PlayerCompositionParams
{
    // Solid forms use aged tin; the face squares use the unlit emissive material (flat paint look),
    // shared with lamp faces to save a draw call.
    const ids = {
        instancedMeshId_box: MeshDataUtil.getInstancedMeshId("Box", "InstancedTin"),
        instancedMeshId_cylinder: MeshDataUtil.getInstancedMeshId("Cylinder", "InstancedTin"),
        instancedMeshId_square: MeshDataUtil.getInstancedMeshId("Square", "InstancedEmissive"),
    };
    const types = {head: 0, ear: 0, hat: 0, torso: 0, arm: 0, bottom: 0};
    const colors = {head: ZERO_VEC3, ear: ZERO_VEC3, hat: ZERO_VEC3, torso: ZERO_VEC3, arm: ZERO_VEC3, bottom: ZERO_VEC3};
    return {ids, types, colors};
}

// Each slot's parts, placed on the body. A slot reads only its own type, which getStructuralVariants relies on.
const SLOT_PART_CONSTRUCTORS: {[slotName: string]:
    (params: PlayerCompositionParams, parts: InstancedMeshCompositionPart[]) => void} =
{
    head: (params, parts) => {
        getBuilder("PlayerHead", params.types.head)(params, parts)
            .offset(0, 6, 0).run();
    },
    ear: (params, parts) => {
        getBuilder("PlayerEar", params.types.ear)(params, parts)
            .offset(2.5, 6, 0).run();
        getBuilder("PlayerEar", params.types.ear)(params, parts)
            .offset(-2.5, 6, 0).backward().run();
    },
    hat: (params, parts) => {
        getBuilder("PlayerHat", params.types.hat)(params, parts)
            .offset(0, 9, 0).run();
    },
    torso: (params, parts) => {
        getBuilder("PlayerTorso", params.types.torso)(params, parts)
            .offset(0, -1, 0).run();
    },
    arm: (params, parts) => {
        getBuilder("PlayerArm", params.types.arm)(params, parts)
            .offset(2.5, -1, 0).run();
        getBuilder("PlayerArm", params.types.arm)(params, parts)
            .offset(-2.5, -1, 0).backward().run();
    },
    bottom: (params, parts) => {
        getBuilder("PlayerBottom", params.types.bottom)(params, parts)
            .offset(0, -8, 0).run();
    },
};

function constructParts(params: PlayerCompositionParams,
    parts: InstancedMeshCompositionPart[])
{
    const map = InstancedMeshCompositionBuilderMap;

    SLOT_PART_CONSTRUCTORS.head(params, parts);
    SLOT_PART_CONSTRUCTORS.ear(params, parts);
    SLOT_PART_CONSTRUCTORS.hat(params, parts);

    map["PlayerNeckAndWaist"](params, parts)
        .offset(0, 3.5, 0).run();

    SLOT_PART_CONSTRUCTORS.torso(params, parts);
    SLOT_PART_CONSTRUCTORS.arm(params, parts);

    map["PlayerNeckAndWaist"](params, parts)
        .offset(0, -5.5, 0).run();

    SLOT_PART_CONSTRUCTORS.bottom(params, parts);
}