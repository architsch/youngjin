import Vec3 from "../../../../../math/types/vec3";
import CannonCompositionUtil from "../../util/cannonCompositionUtil";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// A cannon's look, which has nothing to choose and so nothing to store: its parts are always the same, and how they
// stand comes from the cannon's own state (see CannonObjectTypeConfig).
export const CannonCompositionCodec: InstancedMeshCompositionCodec = {
    encode: (params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]): string =>
    {
        return "";
    },
    decode: (strToDecode: string, objectSize: Vec3,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]): void =>
    {
        for (const part of CannonCompositionUtil.buildParts())
            decodedParts.push(part);
    },
    getRandomComposition: (seed: number, objectSize: Vec3):
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
    {
        return {params: {}, parts: CannonCompositionUtil.buildParts()};
    },
    getStructuralVariants: (): string[] =>
    {
        return [""];
    },
}
