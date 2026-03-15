import Vec3 from "../../math/types/vec3";

export default interface PhysicsColliderUpdateResult
{
    resolvedPos: Vec3;
    desyncDetected: boolean;
}