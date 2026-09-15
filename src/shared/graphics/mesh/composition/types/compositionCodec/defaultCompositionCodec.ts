import Vec3 from "../../../../../math/types/vec3";
import StringUtil from "../../../../../math/util/stringUtil";
import { GEOMETRY_CODE_BY_ID, GEOMETRY_ID_BY_CODE, INSTANCE_COLORED_MATERIAL_IDS, INSTANCED_WOOD_MATERIAL_ID,
    MATERIAL_CODE_BY_ID, MATERIAL_ID_BY_CODE } from "../../../../../system/sharedConstants";
import MeshDataUtil from "../../../util/meshDataUtil";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// Moulding band width range (world units). Decoding never yields less than one step, so a damaged
// string still draws a band.
const MAX_MOULDING_THICKNESS = 0.5;
const MIN_MOULDING_THICKNESS = MAX_MOULDING_THICKNESS / 93;
const FALLBACK_MOULDING_THICKNESS_RAW = 10;

// Parts are space-separated words: geometry, material, dir, offset, scale, then the color if the
// material is instance-colored, then the moulding (color, band width, proud/sunk) if it is wood.
export const DefaultCompositionCodec: InstancedMeshCompositionCodec = {
    encode: (params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]): string =>
    {
        const partChars: string[] = [];
        for (let i = 0; i < parts.length; ++i)
        {
            const part = parts[i];
            const ids = part.instancedMeshId.split("+");
            const geometryId = ids[0];
            const materialId = ids[1];

            partChars.push(StringUtil.convertRawNumberToVisibleASCII(GEOMETRY_CODE_BY_ID[geometryId]));
            partChars.push(StringUtil.convertRawNumberToVisibleASCII(MATERIAL_CODE_BY_ID[materialId]));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.dir.x, -1, 1));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.dir.y, -1, 1));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.dir.z, -1, 1));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.offset.x, -1.25, 1.25));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.offset.y, -1.25, 1.25));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.offset.z, -1.25, 1.25));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.scale.x, 0, 2.5));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.scale.y, 0, 2.5));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.scale.z, 0, 2.5));
            if (INSTANCE_COLORED_MATERIAL_IDS.includes(materialId))
            {
                partChars.push(StringUtil.convertNumberToVisibleASCII(part.color!.x, 0, 255));
                partChars.push(StringUtil.convertNumberToVisibleASCII(part.color!.y, 0, 255));
                partChars.push(StringUtil.convertNumberToVisibleASCII(part.color!.z, 0, 255));
            }
            if (materialId == INSTANCED_WOOD_MATERIAL_ID)
            {
                const mouldingColor = part.mouldingColor ?? part.color!;
                partChars.push(StringUtil.convertNumberToVisibleASCII(mouldingColor.x, 0, 255));
                partChars.push(StringUtil.convertNumberToVisibleASCII(mouldingColor.y, 0, 255));
                partChars.push(StringUtil.convertNumberToVisibleASCII(mouldingColor.z, 0, 255));
                partChars.push(StringUtil.convertNumberToVisibleASCII(part.mouldingThickness!, 0, MAX_MOULDING_THICKNESS));
                partChars.push(StringUtil.convertRawNumberToVisibleASCII(part.mouldingIsConvex ? 1 : 0));
            }

            if (i < parts.length-1)
                partChars.push(" ");
        }
        return partChars.join("");
    },
    decode: (strToDecode: string,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]): void =>
    {
        // First two chars are for the codec's type and version, respectively.
        const wordsToDecode = strToDecode.substring(2).split(" ");
        for (let i = 0; i < wordsToDecode.length; ++i)
        {
            const word = wordsToDecode[i];
            let charOffset = 0;

            const geometryId = GEOMETRY_ID_BY_CODE[StringUtil.convertVisibleASCIIToRawNumber(word, charOffset++)];
            const materialId = MATERIAL_ID_BY_CODE[StringUtil.convertVisibleASCIIToRawNumber(word, charOffset++)];
            const instancedMeshId = MeshDataUtil.getInstancedMeshId(geometryId, materialId);
            
            const dir: Vec3 = {
                x: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, -1, 1),
                y: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, -1, 1),
                z: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, -1, 1),
            };
            const offset: Vec3 = {
                x: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, -1.25, 1.25),
                y: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, -1.25, 1.25),
                z: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, -1.25, 1.25),
            };
            const scale: Vec3 = {
                x: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, 0, 2.5, 1),
                y: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, 0, 2.5, 1),
                z: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, 0, 2.5, 1),
            };

            const part: InstancedMeshCompositionPart = {instancedMeshId, dir, offset, scale};
            if (INSTANCE_COLORED_MATERIAL_IDS.includes(materialId))
            {
                part.color = {
                    x: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, 0, 255, 255),
                    y: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, 0, 255, 0),
                    z: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, 0, 255, 255),
                };
            }
            if (materialId == INSTANCED_WOOD_MATERIAL_ID)
            {
                part.mouldingColor = {
                    x: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, 0, 255, 255),
                    y: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, 0, 255, 0),
                    z: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, 0, 255, 255),
                };
                part.mouldingThickness = Math.max(MIN_MOULDING_THICKNESS, StringUtil.convertVisibleASCIIToNumber(
                    word, charOffset++, 0, MAX_MOULDING_THICKNESS, FALLBACK_MOULDING_THICKNESS_RAW));
                part.mouldingIsConvex = StringUtil.convertVisibleASCIIToRawNumber(word, charOffset++, 1) != 0;
            }
            decodedParts.push(part);
        }
    },
    getRandomComposition: (seed: number):
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
    {
        throw new Error("DefaultCompositionCodec::getRandomComposition : NOT IMPLEMENTED");
    },
    getStructuralVariants: (): string[] =>
    {
        // Spells out arbitrary parts, so no set of variants bounds it.
        throw new Error("DefaultCompositionCodec::getStructuralVariants : NOT IMPLEMENTED");
    },
}