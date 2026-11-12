import ProceduralSoundSpec from "../types/proceduralSoundSpec";

// A soft tone's overtones, fading faster than it does.
const SOFT = [{ratio: 1, gain: 1}, {ratio: 2, gain: 0.22, decay: 0.05}, {ratio: 3, gain: 0.07, decay: 0.03}];
// A coin's ring: close, unrelated modes, which beat against each other.
const COIN = [{ratio: 1, gain: 1, decay: 0.3}, {ratio: 1.41, gain: 0.7, decay: 0.22}, {ratio: 2.19, gain: 0.45, decay: 0.14},
    {ratio: 2.89, gain: 0.28, decay: 0.09}, {ratio: 3.71, gain: 0.14, decay: 0.06}];

// The game's own sounds, which AudioBundleBuilder puts in the bundle as clips of these names, beside the recordings the
// audio manifest lists. Each sounds where AudioTriggerUtil says.
export const ProceduralSounds: ProceduralSoundSpec[] = [
    // A dollar reaching the count: a coin's ring, struck twice.
    {name: "dollar/gain", duration: 0.6, peak: 0.45, layers: [
        {attack: 0.0004, decay: 0.002, gain: 0.3, noise: {filter: "highpass", frequency: [5000, 5000]}},
        {attack: 0.001, decay: 0.3, gain: 1, tone: {frequency: [1500, 1500], partials: COIN}},
        {delay: 0.07, attack: 0.001, decay: 0.3, gain: 0.9, tone: {frequency: [1890, 1890], partials: COIN}},
    ]},
    // The day's reward shown: a run of coins, rising, and a chime under them.
    {name: "dollar/reward", duration: 1.1, peak: 0.5, layers: [
        {attack: 0.001, decay: 0.3, gain: 0.8, tone: {frequency: [1500, 1500], partials: COIN}},
        {delay: 0.08, attack: 0.001, decay: 0.3, gain: 0.8, tone: {frequency: [1680, 1680], partials: COIN}},
        {delay: 0.16, attack: 0.001, decay: 0.3, gain: 0.8, tone: {frequency: [1890, 1890], partials: COIN}},
        {delay: 0.24, attack: 0.001, decay: 0.3, gain: 0.8, tone: {frequency: [2000, 2000], partials: COIN}},
        {delay: 0.32, attack: 0.001, decay: 0.35, gain: 0.9, tone: {frequency: [2245, 2245], partials: COIN}},
        {delay: 0.34, attack: 0.02, decay: 0.3, gain: 0.5, tone: {frequency: [659.26, 659.26], partials: SOFT}},
        {delay: 0.34, attack: 0.02, decay: 0.3, gain: 0.5, tone: {frequency: [783.99, 783.99], partials: SOFT}},
    ]},

    // A cannon that has fired its last ball, gone: a soft puff of air, falling away.
    {name: "cannon/puff", duration: 0.45, peak: 0.5, layers: [
        {attack: 0.012, decay: 0.09, gain: 1, noise: {filter: "lowpass", frequency: [1400, 350], glide: 0.25, q: 0.8}},
        {attack: 0.02, decay: 0.07, gain: 0.35, noise: {filter: "bandpass", frequency: [900, 500], glide: 0.2, q: 1.2}},
        {attack: 0.004, decay: 0.07, gain: 0.4, tone: {frequency: [150, 85], glide: 0.1}},
    ]},

    // A fan's air, whirring with its blades and humming with its motor: a loop. Its air lies above a cannon's grinding
    // gears and its hum below them, so that the two are told apart.
    {name: "fan/wind", duration: 2, peak: 0.375, loop: true, layers: [
        {attack: 0, decay: Infinity, gain: 1, noise: {filter: "lowpass", frequency: [1800, 1800], q: 0.7}},
        {attack: 0, decay: Infinity, gain: 0.6, noise: {filter: "bandpass", frequency: [840, 840], q: 1.6},
            wobble: {rate: 6, depth: 0.35}},
        {attack: 0, decay: Infinity, gain: 0.12, tone: {frequency: [118, 118]}},
    ]},
];
