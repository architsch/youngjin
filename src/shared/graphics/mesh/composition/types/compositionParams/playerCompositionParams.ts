import Vec3 from "../../../../../math/types/vec3";
import { InstancedMeshCompositionParams } from "./instancedMeshCompositionParams";

export default interface PlayerCompositionParams extends InstancedMeshCompositionParams
{
    types: {
        head: number,
        ear: number,
        hat: number,
        torso: number,
        arm: number,
        bottom: number,
    },
    colors: {
        head: Vec3,
        ear: Vec3,
        hat: Vec3,
        torso: Vec3,
        arm: Vec3,
        bottom: Vec3,
    },
}