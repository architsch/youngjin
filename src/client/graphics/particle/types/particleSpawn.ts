import Vec3 from "../../../../shared/math/types/vec3";

// One transient particle's starting state, written once into its batch's ring (see ParticleBatch). The
// shader works out everything after its birth from this and the clock.
export default interface ParticleSpawn
{
    origin: Vec3;
    spawnTime: number;
    velocity: Vec3;
    lifetime: number;
    paramRow: number; // its layer's row in the parameter texture
    seed: number; // in [0, 1), for the per-particle variation the shader derives
    size: number; // world units
    packedTint: number; // see ParticleColorUtil
    levelAtBirth: number; // the emitter's level when it was born
    landingY: number; // the floor it is held at, or far below the room
}
