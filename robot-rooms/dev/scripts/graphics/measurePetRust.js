// Measures how much of a pet's tin shows rust at each age the tin takes (see instancedTinShader.ts), by working out the
// tin's rust over the pet's tin parts (its labels aside) with the game's own baked noise, and prints the age at each of
// a pet's steps of rust that rusts that step's share of it: RUST_AGES in PetCompositionUtil. Run it again after
// changing the tin's rust, or a pet's parts:
//
//   node dev/scripts/graphics/measurePetRust.js [--curve]
//
// --curve also prints the share rusted, and the mean rust, at each tenth of the ages.

const path = require("path");
const Module = require("module");

const REPO_ROOT = path.join(__dirname, "../../..");
// What counts as rust: a point whose color is at least this far from the paint's toward the rust's.
const RUSTED = 0.5;
// Points sampled along each side of a box face, and around and along a cylinder.
const BOX_SAMPLES = 40;
const CYLINDER_SAMPLES = 30;

function load()
{
    const esbuild = require("esbuild");
    const result = esbuild.buildSync({
        stdin: {
            contents: `export { default as ValueNoiseTextureUtil, VALUE_NOISE_PERIOD } from "./src/client/graphics/util/valueNoiseTextureUtil";
export { VALUE_NOISE_SECOND_OCTAVE, VALUE_NOISE_THIRD_OCTAVE } from "./src/client/graphics/shaders/valueNoiseGLSL";
export { default as PetCompositionUtil } from "./src/shared/graphics/mesh/composition/util/petCompositionUtil";
export { default as PetCompositionConstants } from "./src/shared/graphics/mesh/composition/types/compositionConstants/petCompositionConstants";
export { PET_RUST_LEVELS } from "./src/shared/object/util/petShownStateUtil";
export { INSTANCED_TIN_MATERIAL_ID } from "./src/shared/system/sharedConstants";`,
            resolveDir: REPO_ROOT,
            loader: "ts",
        },
        bundle: true,
        write: false,
        platform: "node",
        format: "cjs",
        target: "node20",
        packages: "external",
        logLevel: "silent",
    });
    const entry = path.join(REPO_ROOT, "measurePetRust.bundle.js");
    const module_ = new Module(entry, null);
    module_.filename = entry;
    module_.paths = Module._nodeModulePaths(REPO_ROOT);
    module_._compile(result.outputFiles[0].text, entry);
    return module_.exports;
}

const m = load();

// The noise texture, as the shader reads it: linearly filtered, and repeated.
const shader = {uniforms: {}};
m.ValueNoiseTextureUtil.bindUniform(shader);
const texture = shader.uniforms.valueNoiseTexture.value;
const data = texture.image.data;
const size = texture.image.width;
function readTexel(x, y, z)
{
    const wrap = (n) => ((n % size) + size) % size;
    return data[(((wrap(z) * size) + wrap(y)) * size + wrap(x)) * 4 + 3] / 255;
}
function readNoise(px, py, pz)
{
    const u = px / m.VALUE_NOISE_PERIOD * size - 0.5;
    const v = py / m.VALUE_NOISE_PERIOD * size - 0.5;
    const w = pz / m.VALUE_NOISE_PERIOD * size - 0.5;
    const x0 = Math.floor(u), y0 = Math.floor(v), z0 = Math.floor(w);
    const fx = u - x0, fy = v - y0, fz = w - z0;
    let sum = 0;
    for (let dz = 0; dz < 2; ++dz)
        for (let dy = 0; dy < 2; ++dy)
            for (let dx = 0; dx < 2; ++dx)
                sum += readTexel(x0 + dx, y0 + dy, z0 + dz) * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
    return sum;
}
const SECOND = Number(m.VALUE_NOISE_SECOND_OCTAVE.toFixed(2));
const THIRD = Number(m.VALUE_NOISE_THIRD_OCTAVE.toFixed(2));
function readFbm([x, y, z])
{
    return (0.5 * readNoise(x, y, z) + 0.25 * readNoise(x * SECOND, y * SECOND, z * SECOND)
        + 0.125 * readNoise(x * THIRD, y * THIRD, z * THIRD)) / 0.875;
}
function smoothstep(from, to, x)
{
    const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
    return t * t * (3 - 2 * t);
}

// Points on a part's unit geometry (from -0.5 to 0.5), with the area each stands for; never a box's underside.
function getBoxPoints(scale)
{
    const points = [];
    for (const [a, b, c] of [[0, 1, 2], [1, 2, 0], [2, 0, 1]])
    {
        for (const side of [-0.5, 0.5])
        {
            if (a == 1 && side < 0)
                continue;
            for (let i = 0; i < BOX_SAMPLES; ++i)
            {
                for (let j = 0; j < BOX_SAMPLES; ++j)
                {
                    const p = [0, 0, 0];
                    p[a] = side;
                    p[b] = (i + 0.5) / BOX_SAMPLES - 0.5;
                    p[c] = (j + 0.5) / BOX_SAMPLES - 0.5;
                    points.push({p, area: scale[b] * scale[c] / (BOX_SAMPLES * BOX_SAMPLES)});
                }
            }
        }
    }
    return points;
}
function getCylinderPoints(scale)
{
    const n = CYLINDER_SAMPLES;
    const points = [];
    for (let i = 0; i < n; ++i)
    {
        for (let j = 0; j < n; ++j)
        {
            const turn = 2 * Math.PI * (i + 0.5) / n;
            points.push({p: [0.5 * Math.cos(turn), (j + 0.5) / n - 0.5, 0.5 * Math.sin(turn)],
                area: Math.PI * scale[0] * scale[1] / (n * n)});
        }
    }
    for (const side of [-0.5, 0.5])
    {
        for (let i = 0; i < n; ++i)
        {
            for (let j = 0; j < n; ++j)
            {
                const radius = 0.5 * Math.sqrt((i + 0.5) / n), turn = 2 * Math.PI * (j + 0.5) / n;
                points.push({p: [radius * Math.cos(turn), side, radius * Math.sin(turn)],
                    area: Math.PI * 0.25 * scale[0] * scale[2] / (n * n)});
            }
        }
    }
    return points;
}

// What the shader reads at each point of the pet's tin, its labels aside.
const C = m.PetCompositionConstants;
const surface = [];
m.PetCompositionUtil.buildParts().forEach((part, i) => {
    if (part.materialId != m.INSTANCED_TIN_MATERIAL_ID || (i >= C.firstLabelIndex && i < C.firstLabelIndex + C.numLabels))
        return;
    const scale = [part.scale.x, part.scale.y, part.scale.z];
    for (const {p, area} of (part.geometryId == "Box") ? getBoxPoints(scale) : getCylinderPoints(scale))
    {
        const at = p.map((value, axis) => value * scale[axis] * 16 + scale[axis] * 41);
        const axisDist = p.map(value => Math.abs(value) * 2);
        const edge = smoothstep(0.72, 1.0, axisDist[0] + axisDist[1] + axisDist[2] - Math.max(...axisDist)
            - Math.min(...axisDist));
        surface.push({patch: readFbm(at), grain: readNoise(at[0] * 5, at[1] * 5, at[2] * 5), edge, area});
    }
});
const totalArea = surface.reduce((total, point) => total + point.area, 0);

// The share of the tin rusted at an age, and its mean rust.
function measure(age)
{
    let rusted = 0;
    let mean = 0;
    for (const {patch, grain, edge, area} of surface)
    {
        const aged = patch + 0.45 * age;
        const wear = Math.min(1, edge * (0.35 + 0.65 * grain) * (1 + age));
        const rust = Math.min(1, Math.max(0, smoothstep(0.56, 0.76, aged) + 0.5 * wear * smoothstep(0.40, 0.62, aged)))
            * (0.6 + 0.4 * grain);
        if (rust >= RUSTED)
            rusted += area;
        mean += rust * area;
    }
    return {rusted: rusted / totalArea, mean: mean / totalArea};
}

if (process.argv.includes("--curve"))
{
    for (let tenth = -10; tenth <= 10; ++tenth)
    {
        const {rusted, mean} = measure(tenth / 10);
        console.log(`age ${(tenth / 10).toFixed(1).padStart(4)}: ${(100 * rusted).toFixed(1).padStart(5)}% rusted, `
            + `mean rust ${(100 * mean).toFixed(1)}%`);
    }
}

// None at the first step, the age that rusts each further step's share of them all, and the most past the last, as
// scrap.
const steps = m.PET_RUST_LEVELS;
const ages = [-1];
for (let step = 1; step < steps; ++step)
{
    let low = -1;
    let high = 1;
    for (let i = 0; i < 40; ++i)
    {
        const middle = 0.5 * (low + high);
        if (measure(middle).rusted < step / steps)
            low = middle;
        else
            high = middle;
    }
    ages.push(Number((0.5 * (low + high)).toFixed(4)));
}
ages.push(1);
console.log(`RUST_AGES = [${ages.join(", ")}]`);
console.log(ages.map((age, step) => `${(step < steps) ? `step ${step}` : "scrap"}: `
    + `${(100 * measure(age).rusted).toFixed(1)}% rusted`).join("\n"));
