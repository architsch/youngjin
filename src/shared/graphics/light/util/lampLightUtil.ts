import NumUtil from "../../../math/util/numUtil";
import { MAX_ROOM_PREFS_STEP } from "../../../room/util/roomPrefsUtil";

// What a lamp somebody installed gives off, as two settings rather than one or three.
//
// Three would be wrong for the reason the head lamp's own note gives (see HeadLightUtil):
// brightness, reach and falloff offered as three free dials mostly describe lamps that do not
// exist. **One would be wrong too, and that is what is particular here.** A lamp's strength and its
// spread are genuinely independent wishes: a wash that fills a room softly and a tight pool that
// picks one thing out of the dark are opposite ends of the *same* dial if there is only one, so
// asking for a dim spotlight or a broad glow is impossible. Two dials is the smallest number that
// can express both.
//
//   - **Intensity** — how much light there is. Nothing about where it goes.
//   - **Spread** — how far it carries and how sharply it falls off on the way, which are one
//     question: a light that reaches the far wall and a light that stops dead a pace away differ in
//     both at once, and a lamp given a long reach with a steep falloff is a lamp whose range does
//     nothing.
const LampLightUtil =
{
    // Geometric rather than linear, because brightness is judged in ratios: the difference between
    // a lamp at 1 and one at 2 is the difference the eye also sees between 6 and 12, and a linear
    // slider spends most of its travel on differences nobody can pick out while cramming every
    // usable dim setting into its first few steps.
    getIntensity: (intensityStep: number): number =>
    {
        const t = NumUtil.normalizeInRange(intensityStep, 0, MAX_ROOM_PREFS_STEP);
        return MIN_INTENSITY * Math.pow(MAX_INTENSITY / MIN_INTENSITY, t);
    },
    getRange: (spreadStep: number): number =>
    {
        return interpolate(spreadStep, MIN_SPREAD_RANGE, MAX_SPREAD_RANGE);
    },
    getDecay: (spreadStep: number): number =>
    {
        return interpolate(spreadStep, MIN_SPREAD_DECAY, MAX_SPREAD_DECAY);
    },
}

// A lamp is furniture rather than a torch, so the bottom of the intensity range is a small light
// and not a dark fitting — there is nothing on screen to tell an unconfigured lamp from a broken
// one, so it has to be a light either way.
//
// The top is far above what is needed to light a room, and deliberately so: it is what makes a lamp
// able to blow out the surface it is mounted on and everything near it, which is the whole of a
// dramatic light. Past a point the room's own exposure clips (see LIGHT_BLOCK_MAP_MAX_BRIGHTNESS)
// — that is not a limit being exceeded, it is the effect.
const MIN_INTENSITY = 0.2;
const MAX_INTENSITY = 12;

// At the tight end, a pool of light a couple of blocks across that goes to nothing quickly. At the
// wide end, a wash that carries the length of a room and falls off gently enough to still be
// putting light on the far wall. The decay runs the other way from the range for the reason in the
// note above: they are two halves of one description.
const MIN_SPREAD_RANGE = 4;
const MAX_SPREAD_RANGE = 30;
const MIN_SPREAD_DECAY = 1.2;
const MAX_SPREAD_DECAY = 0.3;

function interpolate(step: number, atMin: number, atMax: number): number
{
    const t = NumUtil.normalizeInRange(step, 0, MAX_ROOM_PREFS_STEP);
    return atMin + (atMax - atMin) * t;
}

export default LampLightUtil;
