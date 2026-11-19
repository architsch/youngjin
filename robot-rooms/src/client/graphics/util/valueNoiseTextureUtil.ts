import * as THREE from "three";

// Shared value-noise field baked into a 3D texture. Evaluating it per fragment was the most expensive
// cost on phones; a filtered fetch is far cheaper. All procedural surfaces, smoke, clouds and ground
// read this one field. Tiling doesn't show: the period is large relative to default feature sizes,
// and octaves use non-commensurate ratios (see VALUE_NOISE_FBM_PERIOD).

// Period in noise units. Set by the sky, whose dome spans about twice the cloud scale; a shorter
// period would repeat clouds visibly.
export const VALUE_NOISE_PERIOD = 16;

// Texels per period: trades interpolation accuracy against period length. Kept small so the texture
// (about 1MB) stays in cache for scattered fragment reads.
const VALUE_NOISE_TEXTURE_SIZE = 64;

// Holder never replaced (three.js re-reads "value"; see AtmosphereMaterialUtil).
const valueNoiseTextureUniform: { value: THREE.Data3DTexture | null } = { value: null };

const ValueNoiseTextureUtil =
{
    // Must be called by every shader install that includes VALUE_NOISE_GLSL (an unbound sampler
    // reads black). Bakes lazily on first use, i.e. during the loading screen.
    bindUniform: (shader: THREE.WebGLProgramParametersWithUniforms) =>
    {
        if (valueNoiseTextureUniform.value == null)
            valueNoiseTextureUniform.value = bakeTexture();
        shader.uniforms.valueNoiseTexture = valueNoiseTextureUniform;
    },
}

// RGB: three decorrelated fields read together as a warp vector; A: the scalar field. RGBA because
// three.js has no sized RGB byte 3D format.
function bakeTexture(): THREE.Data3DTexture
{
    const size = VALUE_NOISE_TEXTURE_SIZE;
    const data = new Uint8Array(size * size * size * 4);

    // Per-axis lattice cell and fade, computed once per axis position. Sampled at texel centres with
    // the same smooth fade the per-fragment version used.
    const cellLow = new Int32Array(size);
    const cellHigh = new Int32Array(size);
    const cellFade = new Float32Array(size);
    for (let i = 0; i < size; ++i)
    {
        const coord = (i + 0.5) * (VALUE_NOISE_PERIOD / size);
        const low = Math.floor(coord);
        cellLow[i] = ((low % VALUE_NOISE_PERIOD) + VALUE_NOISE_PERIOD) % VALUE_NOISE_PERIOD;
        cellHigh[i] = (cellLow[i] + 1) % VALUE_NOISE_PERIOD;
        const fraction = coord - low;
        cellFade[i] = fraction * fraction * (3 - 2 * fraction);
    }

    for (let channel = 0; channel < 4; ++channel)
    {
        const lattice = buildLattice(channel);
        for (let z = 0; z < size; ++z)
        {
            const z0 = cellLow[z], z1 = cellHigh[z], fz = cellFade[z];
            for (let y = 0; y < size; ++y)
            {
                const y0 = cellLow[y], y1 = cellHigh[y], fy = cellFade[y];
                for (let x = 0; x < size; ++x)
                {
                    const value = interpolateLattice(lattice,
                        cellLow[x], cellHigh[x], y0, y1, z0, z1, cellFade[x], fy, fz);
                    data[(((z * size) + y) * size + x) * 4 + channel] = value * 255;
                }
            }
        }
    }

    const texture = new THREE.Data3DTexture(data, size, size, size);
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    // The field is seamless, so repeat wrapping makes it edgeless.
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.wrapR = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    // No mipmaps: octaves are read at fixed ratios, and averaging would erase the finest octave.
    texture.generateMipmaps = false;
    // Field values, not colors: no color space conversion.
    texture.needsUpdate = true;
    return texture;
}

// One field's lattice values (precomputed, since each point is read by eight texels).
function buildLattice(seed: number): Float32Array
{
    const lattice = new Float32Array(VALUE_NOISE_PERIOD * VALUE_NOISE_PERIOD * VALUE_NOISE_PERIOD);
    for (let z = 0; z < VALUE_NOISE_PERIOD; ++z)
        for (let y = 0; y < VALUE_NOISE_PERIOD; ++y)
            for (let x = 0; x < VALUE_NOISE_PERIOD; ++x)
                lattice[(z * VALUE_NOISE_PERIOD + y) * VALUE_NOISE_PERIOD + x] =
                    latticeValue(x, y, z, seed);
    return lattice;
}

function interpolateLattice(lattice: Float32Array,
    x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
    fx: number, fy: number, fz: number): number
{
    const z0Row = z0 * VALUE_NOISE_PERIOD, z1Row = z1 * VALUE_NOISE_PERIOD;
    const y00 = (z0Row + y0) * VALUE_NOISE_PERIOD, y01 = (z0Row + y1) * VALUE_NOISE_PERIOD;
    const y10 = (z1Row + y0) * VALUE_NOISE_PERIOD, y11 = (z1Row + y1) * VALUE_NOISE_PERIOD;

    const e00 = lerp(lattice[y00 + x0], lattice[y00 + x1], fx);
    const e01 = lerp(lattice[y01 + x0], lattice[y01 + x1], fx);
    const e10 = lerp(lattice[y10 + x0], lattice[y10 + x1], fx);
    const e11 = lerp(lattice[y11 + x0], lattice[y11 + x1], fx);

    return lerp(lerp(e00, e01, fy), lerp(e10, e11, fy), fz);
}

function lerp(a: number, b: number, t: number): number
{
    return a + (b - a) * t;
}

// Integer hash in [0, 1]. Fields are decorrelated by seed (not offsets), so all four fit one fetch.
function latticeValue(x: number, y: number, z: number, seed: number): number
{
    let hash = Math.imul(x, 374761393) + Math.imul(y, 668265263) +
        Math.imul(z, 1442695041) + Math.imul(seed, 1274126177);
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967295;
}

export default ValueNoiseTextureUtil;
