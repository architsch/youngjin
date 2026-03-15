import Vec3 from "../../math/types/vec3";

export default interface PhysicsHitState
{
    minHitRayScale: number;
    hitNormal: Vec3 | undefined;
}