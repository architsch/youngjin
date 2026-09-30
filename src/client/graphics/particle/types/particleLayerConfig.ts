import Vec3 from "../../../../shared/math/types/vec3";
import { ParticleRenderState } from "../../../../shared/graphics/particle/types/particleRenderState";
import { ParticleOrientation } from "./particleOrientation";
import { ParticleLaunchDirection } from "./particleLaunchDirection";

// One stream of particles within an effect (see ParticleEffectConfig). Ranges are [min, max], drawn per
// particle. An effect's frame is its direction (z) and two axes across it (see
// Geometry3DUtil.getFacingBasis). Curves are evenly spaced samples from birth to death, blended linearly.
export default interface ParticleLayerConfig
{
    sprite: string; // ParticleAtlasUtil sprite id
    renderState?: ParticleRenderState; // "blended" if absent
    additiveness?: number; // 0 (alpha-blended) to 1 (additive); blended only
    lit?: boolean; // tinted by the lamp light where it floats; blended only
    orientation?: ParticleOrientation; // "camera" if absent
    stretch?: number; // "velocity" orientation: extra length per unit of speed

    burst?: number; // how many at once, when played or started
    rate?: number; // how many per second while emitting
    duration?: number; // how long a played effect keeps emitting at its rate, in seconds

    // Half-extents of the box particles are born in, in the effect's frame.
    spawnHalfSize?: Vec3;
    // Born on the box's faces rather than inside it, e.g. around a block that would hide them.
    spawnOnSurface?: boolean;
    launch?: ParticleLaunchDirection; // "forward" if absent
    spread?: number; // how far the launch direction may stray, in radians
    speed: [number, number];
    lifetime: [number, number];
    size: [number, number];
    spin?: [number, number]; // radians per second
    gravity?: number; // world units per second squared, downward (negative rises)
    drag?: number; // per second
    turbulence?: number; // how far the shared value noise pushes it, in world units
    landing?: boolean; // held at the floor below where it was born

    sizeCurve?: number[];
    alphaCurve?: number[];
    colorCurve?: string[]; // "#rrggbb"
    frameRate?: number; // flipbook frames per second; if absent, the frames play once over its life
}
