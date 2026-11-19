import ProceduralSoundLayer from "../types/proceduralSoundLayer";
import ProceduralSoundSpec from "../types/proceduralSoundSpec";

// How much of a loop's end is folded over its start, so that its seam is no jump.
const LOOP_CROSSFADE_SECONDS = 0.25;
// How long a sound that isn't a loop takes to fade out at its end, wherever its layers have got to.
const END_FADE_SECONDS = 0.005;
// How long a grain of crackle takes to fall to a third.
const GRAIN_DECAY_SECONDS = 0.003;

// Makes the sounds the game's own clips are (see ProceduralSounds): the same samples for the same spec every time, its
// noise drawn from a seed that is its name.
const ProceduralSoundUtil =
{
    // One channel, at sampleRate.
    render: (spec: ProceduralSoundSpec, sampleRate: number): Float32Array =>
    {
        const length = Math.round(spec.duration * sampleRate);
        const crossfade = spec.loop ? Math.min(length, Math.round(LOOP_CROSSFADE_SECONDS * sampleRate)) : 0;
        const samples = new Float32Array(length + crossfade);
        const random = createRandom(getSeed(spec.name));
        for (const layer of spec.layers)
            addLayer(samples, layer, sampleRate, random);
        const sound = spec.loop ? foldLoop(samples, length, crossfade) : fadeOutEnd(samples, sampleRate);

        let peak = 0;
        for (const sample of sound)
            peak = Math.max(peak, Math.abs(sample));
        if (peak > 0)
        {
            for (let i = 0; i < sound.length; ++i)
                sound[i] *= spec.peak / peak;
        }
        return sound;
    },
}

function addLayer(samples: Float32Array, layer: ProceduralSoundLayer, sampleRate: number, random: () => number): void
{
    const start = Math.round((layer.delay ?? 0) * sampleRate);
    const {tone, noise, wobble} = layer;
    const partials = tone ? (tone.partials ?? [{ratio: 1, gain: 1}]) : [];
    const phases = partials.map(() => 0);
    const filterState = {ic1: 0, ic2: 0};
    const grainFade = Math.exp(-1 / (GRAIN_DECAY_SECONDS * sampleRate));
    let grains = 0;

    for (let i = start; i < samples.length; ++i)
    {
        const t = (i - start) / sampleRate;
        const sinceAttack = Math.max(0, t - layer.attack);
        let value = 0;
        if (tone)
        {
            const frequency = glide(tone.frequency, tone.glide, t);
            for (let k = 0; k < partials.length; ++k)
            {
                phases[k] += 2 * Math.PI * frequency * partials[k].ratio / sampleRate;
                value += partials[k].gain * fall(sinceAttack, partials[k].decay ?? layer.decay) * Math.sin(phases[k]);
            }
        }
        else if (noise)
        {
            let excitation = 2 * random() - 1;
            if (noise.crackle != undefined)
            {
                grains *= grainFade;
                if (random() < noise.crackle / sampleRate)
                    grains += 0.3 + 0.7 * random();
                excitation *= grains;
            }
            value = fall(sinceAttack, layer.decay) * filter(filterState, excitation, noise.filter,
                glide(noise.frequency, noise.glide, t), noise.q ?? Math.SQRT1_2, sampleRate);
        }

        const rising = (layer.attack > 0) ? Math.sin(0.5 * Math.PI * Math.min(1, t / layer.attack)) ** 2 : 1;
        // Timed from the sound's start rather than the layer's, so that a loop's goes round whole in its length.
        const swell = wobble
            ? 1 - wobble.depth * (0.5 - 0.5 * Math.cos(2 * Math.PI * wobble.rate * i / sampleRate)) : 1;
        samples[i] += layer.gain * rising * swell * value;
    }
}

// From the first frequency toward the second, exponentially, over glideSeconds; then held there.
function glide(frequencies: [number, number], glideSeconds: number | undefined, t: number): number
{
    const [from, to] = frequencies;
    if (glideSeconds == undefined || glideSeconds <= 0 || from == to)
        return from;
    return from * (to / from) ** Math.min(1, t / glideSeconds);
}

function fall(t: number, decay: number): number
{
    return (decay == Infinity) ? 1 : Math.exp(-t / decay);
}

// A state-variable filter (in its trapezoidal form, which stays stable as its cutoff glides), with a band of unit gain.
function filter(state: {ic1: number, ic2: number}, input: number, kind: "lowpass" | "bandpass" | "highpass",
    frequency: number, q: number, sampleRate: number): number
{
    const g = Math.tan(Math.PI * Math.min(frequency, 0.45 * sampleRate) / sampleRate);
    const k = 1 / q;
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = input - state.ic2;
    const v1 = a1 * state.ic1 + a2 * v3;
    const v2 = state.ic2 + a2 * state.ic1 + a3 * v3;
    state.ic1 = 2 * v1 - state.ic1;
    state.ic2 = 2 * v2 - state.ic2;
    return (kind == "lowpass") ? v2 : (kind == "bandpass") ? k * v1 : input - k * v1 - v2;
}

// The loop's length of samples, its start mixed with what came after its end, so that its last sample runs on into its
// first. Equal-power, since the two are unrelated noise as often as not.
function foldLoop(samples: Float32Array, length: number, crossfade: number): Float32Array
{
    const loop = samples.slice(0, length);
    for (let i = 0; i < crossfade; ++i)
    {
        const share = i / crossfade;
        loop[i] = samples[i] * Math.sqrt(share) + samples[length + i] * Math.sqrt(1 - share);
    }
    return loop;
}

function fadeOutEnd(samples: Float32Array, sampleRate: number): Float32Array
{
    const fade = Math.min(samples.length, Math.round(END_FADE_SECONDS * sampleRate));
    for (let i = 0; i < fade; ++i)
        samples[samples.length - 1 - i] *= i / fade;
    return samples;
}

// FNV-1a.
function getSeed(name: string): number
{
    let hash = 0x811c9dc5;
    for (let i = 0; i < name.length; ++i)
        hash = Math.imul(hash ^ name.charCodeAt(i), 0x01000193) >>> 0;
    return hash;
}

// Mulberry32.
function createRandom(seed: number): () => number
{
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export default ProceduralSoundUtil;
