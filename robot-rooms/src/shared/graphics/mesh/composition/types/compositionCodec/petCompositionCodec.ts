import Vec3 from "../../../../../math/types/vec3";
import PetCompositionUtil from "../../util/petCompositionUtil";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// A pet's look, which has nothing to choose and so nothing to store: its parts are always the same, and how they show
// comes from the pet's own state (see PetObjectTypeConfig).
export const PetCompositionCodec: InstancedMeshCompositionCodec = {
    encode: (params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]): string =>
    {
        return "";
    },
    decode: (strToDecode: string, objectSize: Vec3,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]): void =>
    {
        for (const part of PetCompositionUtil.buildParts())
            decodedParts.push(part);
    },
    getRandomComposition: (seed: number, objectSize: Vec3):
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
    {
        return {params: {}, parts: PetCompositionUtil.buildParts()};
    },
    getStructuralVariants: (): string[] =>
    {
        return [""];
    },
}
