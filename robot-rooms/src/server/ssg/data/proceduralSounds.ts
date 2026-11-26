import ProceduralSoundLayer from "../types/proceduralSoundLayer";
import ProceduralSoundSpec from "../types/proceduralSoundSpec";

// A soft tone's overtones, fading faster than it does.
const SOFT = [{ratio: 1, gain: 1}, {ratio: 2, gain: 0.22, decay: 0.05}, {ratio: 3, gain: 0.07, decay: 0.03}];
// A coin's ring: close, unrelated modes, which beat against each other.
const COIN = [{ratio: 1, gain: 1, decay: 0.3}, {ratio: 1.41, gain: 0.7, decay: 0.22}, {ratio: 2.19, gain: 0.45, decay: 0.14},
    {ratio: 2.89, gain: 0.28, decay: 0.09}, {ratio: 3.71, gain: 0.14, decay: 0.06}];
// A sine with a trace of its octave: a robot's beep.
const BEEP = [{ratio: 1, gain: 1}, {ratio: 2, gain: 0.08, decay: 0.02}];

// A pet's voice (see PetVoiceUtil), at this pitch before a babble plays each syllable higher or lower: a reedy tone
// whose partials stand where a child's vowels have their formants.
const VOICE_PITCH = 440;
const VOWELS: {[vowel: string]: [number, number][]} = {
    a: [[1, 0.55], [2, 1], [3, 0.75], [4, 0.3], [5, 0.12]],
    e: [[1, 1], [2, 0.45], [3, 0.12], [4, 0.3], [5, 0.4], [6, 0.15]],
    i: [[1, 1], [2, 0.12], [5, 0.18], [6, 0.35], [7, 0.2]],
    o: [[1, 1], [2, 0.8], [3, 0.25], [4, 0.08]],
    u: [[1, 1], [2, 0.35], [3, 0.06]],
};
// An "ee" high up, its upper formant on its third partial.
const HIGH_EE = [{ratio: 1, gain: 1}, {ratio: 2, gain: 0.3}, {ratio: 3, gain: 0.35, decay: 0.02},
    {ratio: 4, gain: 0.08, decay: 0.015}];
// Low and reedy, for a grumble.
const REEDY = [1, 2, 3, 4, 5, 6, 7, 8].map(k => ({ratio: k, gain: 1 / (k * k), ...((k >= 4) ? {decay: 0.06} : {})}));
// A consonant a syllable begins with: its own layers, then the pitch its vowel slides in from (as a share of the
// vowel's), and when and how fast the vowel comes in after it.
const CONSONANTS: {[consonant: string]: {layers: ProceduralSoundLayer[], scoop?: number, delay?: number, attack?: number}} = {
    b: {scoop: 0.9, layers: [{attack: 0.001, decay: 0.007, gain: 0.35, tone: {frequency: [180, 110], glide: 0.01}}]},
    d: {scoop: 1.08, layers: [{attack: 0.0005, decay: 0.003, gain: 0.25,
        noise: {filter: "bandpass", frequency: [3000, 3000], q: 1.5}}]},
    g: {scoop: 0.92, layers: [{attack: 0.0005, decay: 0.005, gain: 0.3, noise: {filter: "bandpass", frequency: [1500, 1500], q: 2}},
        {attack: 0.001, decay: 0.006, gain: 0.2, tone: {frequency: [160, 110], glide: 0.01}}]},
    k: {delay: 0.012, layers: [{attack: 0.0005, decay: 0.009, gain: 0.45,
        noise: {filter: "bandpass", frequency: [2200, 2200], q: 1.8}}]},
    t: {delay: 0.01, layers: [{attack: 0.0005, decay: 0.006, gain: 0.35, noise: {filter: "highpass", frequency: [4000, 4000]}}]},
    m: {delay: 0.018, attack: 0.015, layers: [{attack: 0.006, hold: 0.012, decay: 0.01, gain: 0.5,
        tone: {frequency: [VOICE_PITCH, VOICE_PITCH]}}]},
    n: {delay: 0.016, attack: 0.014, layers: [{attack: 0.006, hold: 0.01, decay: 0.01, gain: 0.5,
        tone: {frequency: [VOICE_PITCH, VOICE_PITCH], partials: [{ratio: 1, gain: 1}, {ratio: 2, gain: 0.2}]}}]},
    w: {delay: 0.015, attack: 0.02, layers: [{attack: 0.006, decay: 0.02, gain: 0.8,
        tone: {frequency: [0.9 * VOICE_PITCH, VOICE_PITCH], glide: 0.02, partials: getVowel("u")}}]},
    y: {delay: 0.014, attack: 0.018, layers: [{attack: 0.006, decay: 0.02, gain: 0.7,
        tone: {frequency: [1.1 * VOICE_PITCH, VOICE_PITCH], glide: 0.02, partials: getVowel("i")}}]},
};
const SYLLABLE_HOLD = 0.045;
const SYLLABLE_DECAY = 0.035;

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

    // A cannon that has fired its last ball, turning to scrap: a soft puff of air, falling away.
    {name: "cannon/puff", duration: 0.45, peak: 0.5, layers: [
        {attack: 0.012, decay: 0.09, gain: 1, noise: {filter: "lowpass", frequency: [1400, 350], glide: 0.25, q: 0.8}},
        {attack: 0.02, decay: 0.07, gain: 0.35, noise: {filter: "bandpass", frequency: [900, 500], glide: 0.2, q: 1.2}},
        {attack: 0.004, decay: 0.07, gain: 0.4, tone: {frequency: [150, 85], glide: 0.1}},
    ]},

    // A pet beamed out as it goes with its owner: a shimmer, rising and thinning away.
    {name: "pet/vanish", duration: 0.75, peak: 0.4, layers: [
        {attack: 0.03, decay: 0.24, gain: 0.6, tone: {frequency: [660, 1320], glide: 0.5, partials: SOFT},
            wobble: {rate: 16, depth: 0.5}},
        {attack: 0.05, decay: 0.22, gain: 0.35, tone: {frequency: [990, 1980], glide: 0.5}, wobble: {rate: 20, depth: 0.5}},
        {attack: 0.04, decay: 0.2, gain: 0.16, noise: {filter: "highpass", frequency: [3000, 7000], glide: 0.5}},
    ]},
    // A pet out of health, breaking down for good: its motor winding down into a puff.
    {name: "pet/death", duration: 0.8, peak: 0.45, layers: [
        {attack: 0.01, decay: 0.3, gain: 0.8, tone: {frequency: [520, 70], glide: 0.5, partials: SOFT},
            wobble: {rate: 10, depth: 0.3}},
        {delay: 0.25, attack: 0.02, decay: 0.12, gain: 0.5, noise: {filter: "lowpass", frequency: [1400, 350], glide: 0.25, q: 0.8}},
    ]},
    // A battery put into a pet: a click as it goes in, and its charge rising in two steps.
    {name: "pet/charge", duration: 0.5, peak: 0.42, layers: [
        {attack: 0.0005, decay: 0.004, gain: 0.3, noise: {filter: "highpass", frequency: [4000, 4000]}},
        {delay: 0.02, attack: 0.005, decay: 0.1, gain: 0.8, tone: {frequency: [440, 880], glide: 0.14, partials: SOFT}},
        {delay: 0.16, attack: 0.004, decay: 0.14, gain: 0.6, tone: {frequency: [1174.66, 1174.66], partials: SOFT}},
    ]},
    // A wrench put to a pet: three turns of a ratchet, and a bolt ringing home.
    {name: "pet/repair", duration: 0.55, peak: 0.42, layers: [
        {attack: 0.0005, decay: 0.008, gain: 0.7, noise: {filter: "bandpass", frequency: [2600, 2600], q: 3}},
        {delay: 0.07, attack: 0.0005, decay: 0.008, gain: 0.7, noise: {filter: "bandpass", frequency: [2900, 2900], q: 3}},
        {delay: 0.14, attack: 0.0005, decay: 0.008, gain: 0.7, noise: {filter: "bandpass", frequency: [3200, 3200], q: 3}},
        {delay: 0.22, attack: 0.001, decay: 0.16, gain: 0.6, tone: {frequency: [1568, 1568], partials: COIN}},
    ]},
    // A pet ramming another: tin on tin, dull and short.
    {name: "pet/strike", duration: 0.3, peak: 0.45, layers: [
        {attack: 0.001, decay: 0.03, gain: 0.9, noise: {filter: "lowpass", frequency: [1800, 500], glide: 0.08}},
        {attack: 0.001, decay: 0.05, gain: 0.8, tone: {frequency: [220, 150], glide: 0.06}},
        {attack: 0.001, decay: 0.05, gain: 0.35, tone: {frequency: [730, 730],
            partials: [{ratio: 1, gain: 1}, {ratio: 1.59, gain: 0.6, decay: 0.04}, {ratio: 2.33, gain: 0.35, decay: 0.03}]}},
    ]},

    // The syllables a pet babbles in, each its consonant and then its vowel, which glides by as much over it.
    ...([["ba", 1.06], ["bo", 0.94], ["di", 1.1], ["du", 0.92], ["ge", 1], ["ka", 0.95], ["ki", 1.08], ["mo", 0.98],
        ["na", 1.04], ["ti", 1.02], ["wa", 1.12], ["yu", 0.9]] as const).map(([syllable, bend]) => getSyllable(syllable, bend)),
    // The robot's sounds now and then among them: a beep, a boop, a bip, one rising and one falling.
    {name: "pet/voice/beep", duration: 0.12, peak: 0.27, layers: [
        {attack: 0.003, hold: 0.06, decay: 0.022, gain: 1, tone: {frequency: [1318.5, 1318.5], partials: BEEP}}]},
    {name: "pet/voice/boop", duration: 0.16, peak: 0.4, layers: [
        {attack: 0.006, hold: 0.06, decay: 0.035, gain: 1, tone: {frequency: [523.25, 466.16], glide: 0.09,
            partials: [{ratio: 1, gain: 1}, {ratio: 2, gain: 0.2, decay: 0.03}]}}]},
    {name: "pet/voice/bip", duration: 0.07, peak: 0.24, layers: [
        {attack: 0.002, hold: 0.022, decay: 0.014, gain: 1, tone: {frequency: [1760, 1760], partials: BEEP}}]},
    {name: "pet/voice/bweep", duration: 0.15, peak: 0.28, layers: [
        {attack: 0.004, hold: 0.07, decay: 0.028, gain: 1, tone: {frequency: [740, 1480], glide: 0.09, partials: BEEP}}]},
    {name: "pet/voice/bloop", duration: 0.16, peak: 0.31, layers: [
        {attack: 0.004, hold: 0.05, decay: 0.04, gain: 1, tone: {frequency: [988, 392], glide: 0.1, partials: BEEP}}]},
    // What a pet feels with no words to say it in. Startled: a "bwoo" shooting up, and a bip.
    {name: "pet/surprise", duration: 0.3, peak: 0.42, layers: [
        {attack: 0.006, hold: 0.06, decay: 0.04, gain: 1, tone: {frequency: [330, 740], glide: 0.11,
            partials: getVowel("o", 0.04)}},
        {delay: 0.15, attack: 0.002, hold: 0.02, decay: 0.02, gain: 0.45, tone: {frequency: [1568, 1568], partials: BEEP}},
    ]},
    // Cross: a low grumble, rolling.
    {name: "pet/growl", duration: 0.42, peak: 0.55, layers: [
        {attack: 0.02, hold: 0.18, decay: 0.07, gain: 1, tone: {frequency: [233, 196], glide: 0.3, partials: REEDY},
            wobble: {rate: 26, depth: 0.55}},
        {attack: 0.02, hold: 0.16, decay: 0.06, gain: 0.35, tone: {frequency: [466, 392], glide: 0.3,
            partials: getVowel("o", 0.06)}},
    ]},
    // Frightened: "eep-eep!"
    {name: "pet/yelp", duration: 0.3, peak: 0.34, layers: [
        {attack: 0.004, hold: 0.05, decay: 0.03, gain: 1, tone: {frequency: [800, 1150], glide: 0.04, partials: HIGH_EE}},
        {delay: 0.13, attack: 0.004, hold: 0.04, decay: 0.03, gain: 0.8,
            tone: {frequency: [880, 1280], glide: 0.04, partials: HIGH_EE}},
    ]},
    // Dropping off to sleep: a yawn, sinking and wavering, into a hum.
    {name: "pet/yawn", duration: 0.85, peak: 0.36, layers: [
        {attack: 0.07, hold: 0.25, decay: 0.12, gain: 1, tone: {frequency: [554, 330], glide: 0.45,
            partials: getVowel("a", 0.12)}, wobble: {rate: 5, depth: 0.15}},
        {delay: 0.4, attack: 0.05, hold: 0.1, decay: 0.12, gain: 0.5,
            tone: {frequency: [311, 262], glide: 0.3, partials: getVowel("u", 0.12)}},
    ]},
    // Its battery run down: three notes falling, as a toy switched off.
    {name: "pet/powerDown", duration: 0.62, peak: 0.38, layers: [
        {attack: 0.004, hold: 0.07, decay: 0.03, gain: 1, tone: {frequency: [880, 880], partials: getVowel("o", 0.03)}},
        {delay: 0.12, attack: 0.004, hold: 0.07, decay: 0.03, gain: 1,
            tone: {frequency: [659.26, 659.26], partials: getVowel("o", 0.03)}},
        {delay: 0.24, attack: 0.004, hold: 0.08, decay: 0.1, gain: 1,
            tone: {frequency: [440, 294], glide: 0.3, partials: getVowel("o", 0.1)}},
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

// A vowel's partials (see VOWELS); given the decay of its layer, its upper ones die away sooner, so that it dulls as it
// fades, as a voice does.
function getVowel(vowel: string, decay?: number): {ratio: number, gain: number, decay?: number}[]
{
    return VOWELS[vowel].map(([ratio, gain]) => ({ratio, gain,
        ...((decay != undefined && ratio >= 4) ? {decay: 0.6 * decay} : {})}));
}

// One of a pet's syllables, by its consonant and vowel (as "ba"), the vowel gliding to bend times its pitch.
function getSyllable(syllable: string, bend: number): ProceduralSoundSpec
{
    const consonant = CONSONANTS[syllable[0]];
    return {name: `pet/voice/${syllable}`, duration: 0.16, peak: 0.45, layers: [
        ...consonant.layers,
        {delay: consonant.delay ?? 0.003, attack: consonant.attack ?? 0.008, hold: SYLLABLE_HOLD, decay: SYLLABLE_DECAY,
            gain: 1, tone: {frequency: [(consonant.scoop ?? 1) * VOICE_PITCH, bend * VOICE_PITCH], glide: SYLLABLE_HOLD + 0.04,
                partials: getVowel(syllable[1], SYLLABLE_DECAY)}},
    ]};
}
