import Vec3 from "../../../../../shared/math/types/vec3";
import StringUtil from "../../../../../shared/math/util/stringUtil";
import { GEOMETRY_CODE_BY_ID, GEOMETRY_ID_BY_CODE, INSTANCED_COLOR_MATERIAL_ID, MATERIAL_CODE_BY_ID, MATERIAL_ID_BY_CODE } from "../../../../../shared/system/sharedConstants";
import InstancedMeshBinding from "../instancedMeshBinding";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

export const DefaultCompositionCodec: InstancedMeshCompositionCodec = {
    encode: (encodeInput: InstancedMeshCompositionPart[]): string =>
    {
        const partChars: string[] = [];
        for (let i = 0; i < encodeInput.length; ++i)
        {
            const part = encodeInput[i];
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
            if (materialId == INSTANCED_COLOR_MATERIAL_ID)
            {
                partChars.push(StringUtil.convertNumberToVisibleASCII(part.color!.x, 0, 255));
                partChars.push(StringUtil.convertNumberToVisibleASCII(part.color!.y, 0, 255));
                partChars.push(StringUtil.convertNumberToVisibleASCII(part.color!.z, 0, 255));
            }

            if (i < encodeInput.length-1)
                partChars.push(" ");
        }
        return partChars.join("");
    },
    decode: (strToDecode: string, decodeOutput: InstancedMeshCompositionPart[]): void =>
    {
        // First two chars are for the codec's type and version, respectively.
        const wordsToDecode = strToDecode.substring(2).split(" ");
        for (let i = 0; i < wordsToDecode.length; ++i)
        {
            const word = wordsToDecode[i];
            let charOffset = 0;

            const geometryId = GEOMETRY_ID_BY_CODE[StringUtil.convertVisibleASCIIToRawNumber(word, charOffset++)];
            const materialId = MATERIAL_ID_BY_CODE[StringUtil.convertVisibleASCIIToRawNumber(word, charOffset++)];
            const instancedMeshId = InstancedMeshBinding.getInstancedMeshId(geometryId, materialId);
            
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

            if (materialId == INSTANCED_COLOR_MATERIAL_ID)
            {
                const color: Vec3 = {
                    x: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, 0, 255, 255),
                    y: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, 0, 255, 0),
                    z: StringUtil.convertVisibleASCIIToNumber(word, charOffset++, 0, 255, 255),
                };
                decodeOutput.push({instancedMeshId, dir, offset, scale, color});
            }
            else
            {
                decodeOutput.push({instancedMeshId, dir, offset, scale});
            }
        }
    },
    getRandomComposition: (): InstancedMeshCompositionPart[] =>
    {
        throw new Error("DefaultCompositionCodec::getRandomComposition : NOT IMPLEMENTED");
    },
}