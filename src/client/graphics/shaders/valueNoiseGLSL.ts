// A 3D value-noise field, shared by the texture-less instanced materials (see MaterialConstructorMap)
// to scatter wear, corrosion and grain over a surface without any image asset. Trilinearly
// interpolated and smoothstep-faded per cell, so the field is continuous across a part's faces; the
// fbm variant stacks a few octaves to give patches an irregular outline rather than uniform blobs.
//
// The names are prefixed rather than plain, because these functions are concatenated into three.js's
// own shader source and must not collide with anything the stock chunks declare.
const VALUE_NOISE_GLSL = `
    float valueNoiseHash(vec3 p)
    {
        p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
    }
    float valueNoise(vec3 p)
    {
        vec3 cell = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(mix(valueNoiseHash(cell + vec3(0.0, 0.0, 0.0)), valueNoiseHash(cell + vec3(1.0, 0.0, 0.0)), f.x),
                mix(valueNoiseHash(cell + vec3(0.0, 1.0, 0.0)), valueNoiseHash(cell + vec3(1.0, 1.0, 0.0)), f.x), f.y),
            mix(mix(valueNoiseHash(cell + vec3(0.0, 0.0, 1.0)), valueNoiseHash(cell + vec3(1.0, 0.0, 1.0)), f.x),
                mix(valueNoiseHash(cell + vec3(0.0, 1.0, 1.0)), valueNoiseHash(cell + vec3(1.0, 1.0, 1.0)), f.x), f.y),
            f.z);
    }
    float valueNoiseFbm(vec3 p)
    {
        float sum = 0.5 * valueNoise(p);
        sum += 0.25 * valueNoise(p * 2.03);
        sum += 0.125 * valueNoise(p * 4.01);
        return sum / 0.875;
    }
`;

export default VALUE_NOISE_GLSL;
