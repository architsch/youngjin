import Vec3 from "../../../../shared/math/types/vec3";

// A light as propagation needs it; never a THREE.PointLight (see LightBlockMap).
export default interface LightSource
{
    worldPos: Vec3;

    // Linear RGB premultiplied by intensity. Plain numbers so the propagation loop never allocates.
    colorR: number;
    colorG: number;
    colorB: number;

    // Same meaning as THREE.PointLight's distance/decay, so both are tuned in the same units.
    range: number;
    decay: number;
}
