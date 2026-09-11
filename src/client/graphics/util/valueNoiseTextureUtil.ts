import * as THREE from "three";

// The value-noise field that every procedural surface and every part of the room's air is drawn from,
// baked once into a 3D texture and *read* by the shaders rather than evaluated by them.
//
// **Why it is baked.** Evaluated in the shader, one sample of this field costs eight hashes and seven
// interpolations, and the places that want it want it several times over: the room's air warps its
// coordinate by three samples of itself and then reads a three-octave sum at the result, which is
// forty-eight hashes for one fragment. That chunk is spliced into every material standing in the room,
// so on a phone it was comfortably the most expensive thing in the frame — more than the lighting, the
// finish and the texture work put together. Read out of a texture instead, the same field costs one
// filtered fetch, and the hardware doing the filtering is idle hardware that the arithmetic units are
// not.
//
// **Why one texture serves everything.** The fog's smoke, the sky's clouds and the land below the
// horizon are three different fields only in what they are read *on* — a place in the room, a
// direction on the dome, a point on a plane — and in what is done with the answer. The field itself is
// the same field, so they share this one and none of them pays to have its own.
//
// **Why it may be tiled without showing.** The texture repeats, and what would give that away is the
// field's own broad shape coming round again within sight. It does not: at the fineness a room asks
// for by default, a whole room is a fraction of one period across (see VALUE_NOISE_PERIOD). The finer
// octaves repeat sooner, but they are read at ratios that come round with the period only a hundred
// periods on, so the sum of the three lines up with itself nowhere anyone could compare — while each
// octave stays continuous across the seam, which is what actually matters. There is no seam to find,
// only a pattern that eventually rhymes; and where it rhymes exactly is what lets the drifting air be
// wrapped without a jump (see VALUE_NOISE_FBM_PERIOD).

// How many noise units the baked field covers before it comes round again.
//
// **Set by the sky, which is the one reader that can see a whole period at once.** The clouds are read
// on a direction, so the entire dome spans only about twice whatever coarseness the room asked for —
// and a period shorter than that puts the same cloud in the sky twice, which is the one thing here the
// eye finds instantly. At this length the default sky is comfortably inside one period. Everything
// else has room to spare: a whole room is a fraction of one period of its own air, and the timber's
// broad figure comes round again only over a span longer than any part it is drawn on.
export const VALUE_NOISE_PERIOD = 16;

// How many texels stand across that period, which together with the period sets how many fall inside
// one lattice cell — and that is the real dial here.
//
// **It trades against the period rather than standing on its own.** The texels carry the smooth curve
// the field is defined by, and the hardware joins them with straight lines, so more of them per cell
// means a closer reproduction of that curve. Fewer means a longer period for the same memory. At the
// pair chosen here the straight lines depart from the true curve by a few percent at the worst point
// of the broadest octave and by almost nothing on the finer ones — invisible on a field that is then
// smoothstepped into cloud or haze, and much the cheaper mistake to make than repeating the sky.
//
// Held down rather than raised, because this is bytes a fragment shader reads at scattered
// coordinates. At this size the whole field is a megabyte and stays in the texture cache; at twice it,
// each of the three octaves would be pulling from a different part of eight megabytes and the fetch
// would start costing what the arithmetic used to.
const VALUE_NOISE_TEXTURE_SIZE = 64;

// Held as one object and never replaced, because three.js keeps whatever object is put into
// shader.uniforms and re-reads its "value" every frame — so writing the value reaches every material
// already compiled, while replacing the holder would reach none of them. The same reason
// AtmosphereMaterialUtil holds its uniforms this way.
const valueNoiseTextureUniform: { value: THREE.Data3DTexture | null } = { value: null };

const ValueNoiseTextureUtil =
{
    // Hands a material being compiled the field its shader is about to read from. Every install that
    // splices in VALUE_NOISE_GLSL has to call this, since that chunk declares the sampler and a
    // sampler nothing binds reads as black — which for these fields is not a degraded picture but a
    // flat one.
    //
    // The bake happens on the first material that asks, which is during the room-loading screen where
    // the shader compilation it accompanies already is. Doing it at module load would put the same
    // work in front of the page's first paint instead, where there is nothing to hide it behind.
    bindUniform: (shader: THREE.WebGLProgramParametersWithUniforms) =>
    {
        if (valueNoiseTextureUniform.value == null)
            valueNoiseTextureUniform.value = bakeTexture();
        shader.uniforms.valueNoiseTexture = valueNoiseTextureUniform;
    },
}

// Fills the texture with four fields at once: three that are only ever read together, as the vector
// the air and the sky drag their own coordinates by, and a fourth that is read on its own and summed
// across octaves. Four channels is what an RGBA texture costs anyway — three.js derives no sized
// format for a three-channel byte 3D texture, the same constraint LightBlockMap ran into — so the
// fourth field rides along free, and the warp that used to be three separate samples becomes one.
function bakeTexture(): THREE.Data3DTexture
{
    const size = VALUE_NOISE_TEXTURE_SIZE;
    const data = new Uint8Array(size * size * size * 4);

    // Where each texel falls on the lattice and how far it stands between two of its points. The same
    // for all three axes and for all four fields, so it is worked out once per axis position rather
    // than a million times over — which is most of what makes the bake quick enough to sit inside a
    // loading screen rather than being noticed as one.
    //
    // Taken at the texel's centre rather than its corner, because that is the coordinate the hardware
    // will hand back unfiltered, and the fade is the same smooth curve the field was defined by when
    // it was still being evaluated per fragment.
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
    // The field is continuous across its own seam by construction, so repeating it is what turns a
    // finite block of texels into a field without edges — which is what every reader of it assumes.
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.wrapR = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    // No mip chain. The octaves are read at fixed ratios rather than at whatever scale a surface
    // happens to be seen at, so there is no level for the hardware to choose between — and a mip
    // chain built by averaging would blur the finest octave into nothing at the first level.
    texture.generateMipmaps = false;
    // Color space left at its default (none): these are field values rather than colors, and having
    // them converted on the way into the shader would bend the very curve that was baked in.
    texture.needsUpdate = true;
    return texture;
}

// One field's lattice: a value at every corner of the repeating block, which everything between them
// is interpolated from. Kept as its own array per field rather than hashed on demand, since every
// point is read eight times over by the texels around it.
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

// A value in [0, 1] for one lattice point of one field, decided by where the point is and which field
// it belongs to. Integer arithmetic throughout, so that the four fields are decorrelated by their seed
// rather than by being sampled at offsets from one another — which is what lets all four be read in a
// single fetch, where offset sampling would need one fetch each.
function latticeValue(x: number, y: number, z: number, seed: number): number
{
    let hash = Math.imul(x, 374761393) + Math.imul(y, 668265263) +
        Math.imul(z, 1442695041) + Math.imul(seed, 1274126177);
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967295;
}

export default ValueNoiseTextureUtil;
