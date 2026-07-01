import Vec3 from "../../../../shared/math/types/vec3";

export default interface InstancedMeshCompositionPart
{
    instancedMeshId: string,
    dir: Vec3,
    offset: Vec3,
    scale: Vec3,
    color?: Vec3,
}