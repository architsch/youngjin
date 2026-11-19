import { VALUE_NOISE_PERIOD } from "../util/valueNoiseTextureUtil";

// Shared 3D value noise, read from a baked texture (see ValueNoiseTextureUtil). Include-guarded,
// because several splices in one material may each include it.

// Non-integer octave ratios in whole hundredths, so the sum doesn't visibly repeat but still has a
// finite period (see VALUE_NOISE_FBM_PERIOD).
export const VALUE_NOISE_SECOND_OCTAVE = 2.03;
export const VALUE_NOISE_THIRD_OCTAVE = 4.01;

// Period of the whole fBm stack. Ever-growing offsets (cloud/smoke drift) are wrapped modulo this to
// keep float precision without a visible seam (see AtmosphereMaterialUtil).
export const VALUE_NOISE_FBM_PERIOD = VALUE_NOISE_PERIOD * 100;

const VALUE_NOISE_GLSL = `
    #ifndef VALUE_NOISE_GLSL_INCLUDED
    #define VALUE_NOISE_GLSL_INCLUDED
    uniform sampler3D valueNoiseTexture;

    const float VALUE_NOISE_INV_PERIOD = ${(1 / VALUE_NOISE_PERIOD).toFixed(8)};

    // Arithmetic point hash, for per-cell random values (no continuity needed).
    float valueNoiseHash(vec3 p)
    {
        p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
    }

    float valueNoise(vec3 p)
    {
        return texture(valueNoiseTexture, p * VALUE_NOISE_INV_PERIOD).a;
    }

    // Three decorrelated fields in one fetch (RGB channels), centred on zero for displacement.
    vec3 valueNoiseWarp(vec3 p)
    {
        return texture(valueNoiseTexture, p * VALUE_NOISE_INV_PERIOD).rgb - 0.5;
    }

    float valueNoiseFbm(vec3 p)
    {
        float sum = 0.5 * texture(valueNoiseTexture, p * VALUE_NOISE_INV_PERIOD).a;
        sum += 0.25 * texture(valueNoiseTexture,
            p * (${VALUE_NOISE_SECOND_OCTAVE.toFixed(2)} * VALUE_NOISE_INV_PERIOD)).a;
        sum += 0.125 * texture(valueNoiseTexture,
            p * (${VALUE_NOISE_THIRD_OCTAVE.toFixed(2)} * VALUE_NOISE_INV_PERIOD)).a;
        return sum / 0.875;
    }
    #endif
`;

export default VALUE_NOISE_GLSL;
