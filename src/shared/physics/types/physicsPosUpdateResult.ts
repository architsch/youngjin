import Vec2 from "../../math/types/vec2"

export default interface PhysicsPosUpdateResult
{
    resolvedPos: Vec2;
    desyncDetected: boolean;
}