import NumUtil from "../../../math/util/numUtil";

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
//   - **Range** — how far it carries, in blocks, and how sharply it falls off on the way, which are
//     one question: a light that reaches the far wall and a light that stops dead a pace away differ
//     in both at once, and a lamp given a long reach with a steep falloff is a lamp whose range does
//     nothing. So the falloff is not a dial of its own — it is read off the reach, running the other
//     way.
//
// **Both dials are a short count of whole values rather than a fine scale, and each value is the
// quantity itself** — an intensity of 4 is four times the light of one at 1, and a range of 9 reaches
// nine blocks. Two things follow from that, and both are the point. A number the user can be shown
// beside the handle means something to them, where a position on a scale of a hundred is a number
// only the code understands. And a dozen values is few enough to be marked out on the slider, so
// what a lamp can be is visible in the control rather than discovered by dragging.
const LampLightUtil =
{
    // The falloff exponent the reach implies: steep for a lamp that stops a few blocks away, gentle
    // for one carrying the length of a room. Straight-line between the two, since the reach it is
    // read off is itself a plain distance.
    getDecay: (range: number): number =>
    {
        return NumUtil.convertRange(range, MIN_LAMP_RANGE, MAX_LAMP_RANGE,
            DECAY_AT_MIN_RANGE, DECAY_AT_MAX_RANGE);
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
export const MIN_LAMP_INTENSITY = 1;
export const MAX_LAMP_INTENSITY = 12;

// At the tight end, a pool of light a few blocks across. At the wide end, a wash that carries the
// length of an ordinary room and still puts light on the far wall. Measured in blocks, which is the
// unit the room is built in and therefore the one somebody choosing a reach is actually thinking in.
export const MIN_LAMP_RANGE = 3;
export const MAX_LAMP_RANGE = 14;

// The decay runs the other way from the range for the reason in the note above: they are two halves
// of one description. Both ends are gentler than the inverse square a real light obeys, because the
// reach is short enough in blocks that a square law would spend the whole of it within a pace.
const DECAY_AT_MIN_RANGE = 1.2;
const DECAY_AT_MAX_RANGE = 0.3;

export default LampLightUtil;
