// The two rules that let a slider's value be typed as well as dragged (see RangeValueInput): what
// a number the slider is standing on looks like written out, and what a string somebody typed means
// to that slider.
//
// They are here rather than inside the field itself because they are the whole of what "the number
// and the handle are one setting" amounts to, and because neither of them is a thing to discover by
// experiment: a value between two steps and a value that is not a number at all are exactly the
// cases a person types and nobody tests by hand.
const RangeValueUtil =
{
    // One decimal digit at most, and none where the value has none — a setting counted in whole
    // steps is written as a whole number rather than padded out to a precision it does not have.
    // Only ever asked of the slider's own value, which is always a number; anything else is handed
    // back untouched rather than having a number invented for it.
    format: (value: string): string =>
    {
        if (!isNumeric(value))
            return value;
        return String(Math.round(Number(value) * 10) / 10);
    },
    // What a typed string asks of a slider with these bounds, or NULL if it asks nothing — which is
    // what a half-typed value, an empty field and a stray letter all are, and which the caller is
    // meant to answer by leaving the handle exactly where it is.
    //
    // A number between two steps is taken **down** to the step below rather than to the nearer one,
    // so that typing a number never quietly asks for more than was typed — which matters where a
    // step is a real quantity, as a lamp's reach in blocks is.
    parse: (typed: string, min: number, max: number, step: number): number | null =>
    {
        if (!isNumeric(typed))
            return null;
        const value = Number(typed);
        if (!(step > 0))
            return clamp(value, min, max);
        // The epsilon is there because the grid is walked by repeated addition in floating point: a
        // value that is exactly a step can land a hair under it, and without the tolerance it would
        // be taken down a whole step.
        const stepsAbove = Math.max(0, Math.floor((value - min) / step + 1e-9));
        return clamp(min + stepsAbove * step, min, max);
    },
}

// Deliberately stricter than parseFloat, which reads a number off the front of anything and would
// take "3 blocks" — and, worse, the empty field left behind by a Backspace — for a value somebody
// asked for.
function isNumeric(text: string): boolean
{
    return text.trim().length > 0 && Number.isFinite(Number(text));
}

function clamp(value: number, min: number, max: number): number
{
    return Math.max(min, Math.min(max, value));
}

export default RangeValueUtil;
