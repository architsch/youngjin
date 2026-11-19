import Vec3 from "../../../../../math/types/vec3";
import CannonCompositionUtil from "../../util/cannonCompositionUtil";
import { InstancedMeshCompositionParams } from "../compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";
import InstancedMeshCompositionCodec from "./instancedMeshCompositionCodec";

// A cannon ball's look, which has nothing to choose and so nothing to store: a sphere as wide as the ball.
export const CannonBallCompositionCodec: InstancedMeshCompositionCodec = {
    encode: (params: InstancedMeshCompositionParams,
        parts: InstancedMeshCompositionPart[]): string =>
    {
        return "";
    },
    decode: (strToDecode: string, objectSize: Vec3,
        decodedParams: InstancedMeshCompositionParams,
        decodedParts: InstancedMeshCompositionPart[]): void =>
    {
        for (const part of CannonCompositionUtil.buildBallParts(objectSize.x))
            decodedParts.push(part);
    },
    getRandomComposition: (seed: number, objectSize: Vec3):
        {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]} =>
    {
        return {params: {}, parts: CannonCompositionUtil.buildBallParts(objectSize.x)};
    },
    getStructuralVariants: (): string[] =>
    {
        return [""];
    },
}
