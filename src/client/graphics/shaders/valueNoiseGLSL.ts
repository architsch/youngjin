import { VALUE_NOISE_PERIOD } from "../util/valueNoiseTextureUtil";

// A 3D value-noise field, shared by the texture-less instanced materials (see MaterialConstructorMap)
// to scatter wear, corrosion and grain over a surface without any image asset, and by the room's air
// and sky to give both their shape.
//
// **The field is read rather than evaluated.** It is baked into a 3D texture once at load — see
// ValueNoiseTextureUtil, which is also where the reasoning lives — so what was eight hashes and seven
// interpolations per sample is now one filtered fetch. Nothing about the field itself changed: the
// same lattice, the same smooth curve between its points, carried in the texels instead of worked out
// again for every fragment that wants it.
//
// The names are prefixed rather than plain, because these functions are concatenated into three.js's
// own shader source and must not collide with anything the stock chunks declare.
//
// Guarded, because more than one of the blocks spliced into a single material can want it — the tin
// or wood finish of a surface and the air in front of it, say — and a function declared twice is a
// compile error. Whichever block lands first in the assembled source declares it for the rest, which
// is also why the sampler is declared in here rather than beside any one of them.
const VALUE_NOISE_GLSL = `
    #ifndef VALUE_NOISE_GLSL_INCLUDED
    #define VALUE_NOISE_GLSL_INCLUDED
    uniform sampler3D valueNoiseTexture;

    const float VALUE_NOISE_INV_PERIOD = ${(1 / VALUE_NOISE_PERIOD).toFixed(8)};

    // A point hash, kept as arithmetic because it is the one thing the texture cannot stand in for.
    // Its callers want one number per cell of a grid of their own — which knot is on this board, how
    // big it grew — rather than a field with anything continuous about it, and a fetch would only be
    // a slower way of asking.
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

    // Three decorrelated fields at one point, for the callers that read this as a direction to drag
    // their own coordinate in. One fetch rather than three, because the four fields were baked into
    // the four channels of one texel precisely so that this — by far the most common way the field is
    // used — costs a single read. Centred on zero, since a displacement wants to pull both ways.
    vec3 valueNoiseWarp(vec3 p)
    {
        return texture(valueNoiseTexture, p * VALUE_NOISE_INV_PERIOD).rgb - 0.5;
    }

    // A few octaves stacked, which is what gives a patch an irregular outline rather than a uniform
    // blob. The ratios between them are deliberately not whole numbers: each octave comes round again
    // at its own period, and periods that share no common multiple mean the sum never repeats itself
    // even though every part of it does.
    float valueNoiseFbm(vec3 p)
    {
        float sum = 0.5 * texture(valueNoiseTexture, p * VALUE_NOISE_INV_PERIOD).a;
        sum += 0.25 * texture(valueNoiseTexture, p * (2.03 * VALUE_NOISE_INV_PERIOD)).a;
        sum += 0.125 * texture(valueNoiseTexture, p * (4.01 * VALUE_NOISE_INV_PERIOD)).a;
        return sum / 0.875;
    }
    #endif
`;

export default VALUE_NOISE_GLSL;
