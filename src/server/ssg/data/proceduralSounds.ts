import ProceduralSoundSpec from "../types/proceduralSoundSpec";

// A soft tone's overtones, fading faster than it does.
const SOFT = [{ratio: 1, gain: 1}, {ratio: 2, gain: 0.22, decay: 0.05}, {ratio: 3, gain: 0.07, decay: 0.03}];
// A hollow, dull tone: odd overtones only.
const DULL = [{ratio: 1, gain: 1}, {ratio: 3, gain: 0.28, decay: 0.03}, {ratio: 5, gain: 0.1, decay: 0.02}];
// A block of wood struck: its modes, the higher dying sooner.
const WOOD = [{ratio: 1, gain: 1}, {ratio: 2.32, gain: 0.55, decay: 0.045}, {ratio: 3.86, gain: 0.32, decay: 0.028},
    {ratio: 6.1, gain: 0.16, decay: 0.017}];
// A small thing set down: fewer, higher modes.
const TAP = [{ratio: 1, gain: 1}, {ratio: 2.62, gain: 0.45, decay: 0.028}, {ratio: 4.47, gain: 0.2, decay: 0.016}];
// A coin's ring: close, unrelated modes, which beat against each other.
const COIN = [{ratio: 1, gain: 1, decay: 0.3}, {ratio: 1.41, gain: 0.7, decay: 0.22}, {ratio: 2.19, gain: 0.45, decay: 0.14},
    {ratio: 2.89, gain: 0.28, decay: 0.09}, {ratio: 3.71, gain: 0.14, decay: 0.06}];
// A small wooden bar tapped, as a marimba's: its overtones far apart, and soon gone.
const BAR = [{ratio: 1, gain: 1}, {ratio: 3.93, gain: 0.3, decay: 0.012}, {ratio: 9.2, gain: 0.08, decay: 0.005}];
// A small bell: nearly whole overtones, dying sooner the higher they are.
const BELL = [{ratio: 1, gain: 1}, {ratio: 2.01, gain: 0.35, decay: 0.12}, {ratio: 3.02, gain: 0.12, decay: 0.07},
    {ratio: 4.23, gain: 0.05, decay: 0.04}];

// The game's own sounds, which AudioBundleBuilder puts in the bundle as clips of these names, beside the recordings the
// audio manifest lists. Each sounds where AudioTriggerUtil says.
export const ProceduralSounds: ProceduralSoundSpec[] = [
    // A control pressed: a soft tick.
    {name: "ui/press", duration: 0.05, peak: 0.5, layers: [
        {attack: 0.0005, decay: 0.004, gain: 1, noise: {filter: "bandpass", frequency: [3200, 3200], q: 1.5}},
        {attack: 0.0005, decay: 0.01, gain: 0.35, tone: {frequency: [1800, 1500], glide: 0.01}},
    ]},
    // A popup coming up: a soft pop, rising; going away, falling.
    {name: "ui/popupOpen", duration: 0.2, peak: 0.55, layers: [
        {attack: 0.004, decay: 0.05, gain: 1, tone: {frequency: [330, 660], glide: 0.06, partials: SOFT}},
        {attack: 0.01, decay: 0.03, gain: 0.25, noise: {filter: "bandpass", frequency: [1500, 2500], glide: 0.05, q: 1.2}},
    ]},
    {name: "ui/popupClose", duration: 0.18, peak: 0.5, layers: [
        {attack: 0.004, decay: 0.045, gain: 1, tone: {frequency: [600, 330], glide: 0.06, partials: SOFT}},
        {attack: 0.01, decay: 0.03, gain: 0.2, noise: {filter: "bandpass", frequency: [2500, 1500], glide: 0.05, q: 1.2}},
    ]},
    // A panel opening: a short swish up; closing, down.
    {name: "ui/panelOpen", duration: 0.15, peak: 0.4, layers: [
        {attack: 0.03, decay: 0.035, gain: 1, noise: {filter: "bandpass", frequency: [900, 2800], glide: 0.09, q: 1.4}},
    ]},
    {name: "ui/panelClose", duration: 0.14, peak: 0.35, layers: [
        {attack: 0.025, decay: 0.035, gain: 1, noise: {filter: "bandpass", frequency: [2600, 900], glide: 0.08, q: 1.4}},
    ]},
    // A click that came to nothing: two dull notes, falling.
    {name: "ui/refusal", duration: 0.34, peak: 0.5, layers: [
        {attack: 0.003, decay: 0.07, gain: 1, tone: {frequency: [240, 210], glide: 0.05, partials: DULL}},
        {delay: 0.11, attack: 0.003, decay: 0.09, gain: 1, tone: {frequency: [200, 175], glide: 0.06, partials: DULL}},
    ]},

    // A block taken down: a crack, and the crumble of it.
    {name: "edit/blockRemove", duration: 0.4, peak: 0.7, layers: [
        {attack: 0.0005, decay: 0.01, gain: 1, noise: {filter: "bandpass", frequency: [2200, 1500], glide: 0.02, q: 0.8}},
        {delay: 0.004, attack: 0.01, decay: 0.12, gain: 1.2, noise: {filter: "lowpass", frequency: [2500, 900], glide: 0.2,
            crackle: 280}},
        {attack: 0.002, decay: 0.06, gain: 0.5, tone: {frequency: [140, 80], glide: 0.06}},
    ]},
    // A block moved: a short scrape, then set down.
    {name: "edit/blockMove", duration: 0.3, peak: 0.6, layers: [
        {attack: 0.02, decay: 0.04, gain: 0.6, noise: {filter: "bandpass", frequency: [1100, 1700], glide: 0.06, q: 1.1,
            crackle: 900}},
        {delay: 0.06, attack: 0.001, decay: 0.06, gain: 1, tone: {frequency: [230, 215], glide: 0.02, partials: WOOD}},
    ]},
    // A face given another texture: a soft, low tap as the new one takes.
    {name: "edit/retexture", duration: 0.2, peak: 0.6, layers: [
        {attack: 0.002, decay: 0.04, gain: 1, tone: {frequency: [340, 320], glide: 0.02, partials: TAP}},
    ]},
    // A block or an object picked out to edit: a light wooden tap; let go of: a lower one, settling.
    {name: "edit/select", duration: 0.12, peak: 0.45, layers: [
        {attack: 0.0004, decay: 0.002, gain: 0.3, noise: {filter: "highpass", frequency: [4000, 4000]}},
        {attack: 0.0008, decay: 0.045, gain: 1, tone: {frequency: [880, 880], partials: BAR}},
    ]},
    {name: "edit/deselect", duration: 0.14, peak: 0.38, layers: [
        {attack: 0.001, decay: 0.05, gain: 1, tone: {frequency: [660, 600], glide: 0.05, partials: BAR}},
    ]},
    // Someone else changing an object's settings: a short breath out.
    {name: "edit/objectChange", duration: 0.25, peak: 0.45, layers: [
        {attack: 0.03, decay: 0.06, gain: 1, noise: {filter: "bandpass", frequency: [1100, 800], glide: 0.12, q: 2}},
        {attack: 0.03, decay: 0.05, gain: 0.6, noise: {filter: "bandpass", frequency: [2400, 1800], glide: 0.12, q: 2.5}},
        {attack: 0.02, decay: 0.04, gain: 0.05, noise: {filter: "highpass", frequency: [4000, 4000]}},
    ]},

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
    // A line of the user's own sent: a whoop, rising.
    {name: "chat/send", duration: 0.18, peak: 0.4, layers: [
        {attack: 0.004, decay: 0.06, gain: 1, tone: {frequency: [440, 1000], glide: 0.07}},
        {attack: 0.006, decay: 0.03, gain: 0.15, noise: {filter: "bandpass", frequency: [2200, 2200], q: 1.2}},
    ]},

    // The tutorial showing what to do next: a faint, brief gust; clearing it away once it is done: a soft bell note.
    {name: "tutorial/show", duration: 0.28, peak: 0.3, layers: [
        {attack: 0.07, decay: 0.06, gain: 1, noise: {filter: "lowpass", frequency: [350, 1100], glide: 0.14, q: 1.3}},
        {attack: 0.08, decay: 0.05, gain: 0.35, noise: {filter: "bandpass", frequency: [700, 1600], glide: 0.14, q: 1.2}},
    ]},
    {name: "tutorial/clear", duration: 0.35, peak: 0.34, layers: [
        {attack: 0.003, decay: 0.11, gain: 1, tone: {frequency: [783.99, 783.99], partials: BELL}},
    ]},

    // A cannon that has fired its last ball, gone: a soft puff of air, falling away.
    {name: "cannon/puff", duration: 0.45, peak: 0.5, layers: [
        {attack: 0.012, decay: 0.09, gain: 1, noise: {filter: "lowpass", frequency: [1400, 350], glide: 0.25, q: 0.8}},
        {attack: 0.02, decay: 0.07, gain: 0.35, noise: {filter: "bandpass", frequency: [900, 500], glide: 0.2, q: 1.2}},
        {attack: 0.004, decay: 0.07, gain: 0.4, tone: {frequency: [150, 85], glide: 0.1}},
    ]},

    // A fan's air, whirring with its blades and humming with its motor: a loop.
    {name: "fan/wind", duration: 2, peak: 0.5, loop: true, layers: [
        {attack: 0, decay: Infinity, gain: 1, noise: {filter: "lowpass", frequency: [900, 900], q: 0.7}},
        {attack: 0, decay: Infinity, gain: 0.6, noise: {filter: "bandpass", frequency: [420, 420], q: 1.6},
            wobble: {rate: 6, depth: 0.35}},
        {attack: 0, decay: Infinity, gain: 0.12, tone: {frequency: [118, 118]}},
    ]},
];
