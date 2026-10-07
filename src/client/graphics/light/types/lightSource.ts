import Vec3 from "../../../../shared/math/types/vec3";

// A light as propagation needs it; never a THREE.PointLight (see LightBlockMap).
export default interface LightSource
{
    // Where its light is measured from.
    worldPos: Vec3;

    // Where its light comes out, which is where spreading it starts. A lamp's is just off its face,
    // nearer than worldPos, so that a lamp built over lights nothing.
    outletPos: Vec3;

    // Linear RGB premultiplied by intensity. Plain numbers so the propagation loop never allocates.
    colorR: number;
    colorG: number;
    colorB: number;

    // Same meaning as THREE.PointLight's distance/decay, so both are tuned in the same units.
    range: number;
    decay: number;
}
