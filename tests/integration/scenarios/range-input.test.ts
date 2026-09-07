/**
 * Scenario tests: the number beside a slider
 *
 * Every slider in the app carries its own value written out next to it, and that number can be
 * typed as well as read (see RangeValueInput). Typing is where a slider stops being safe by
 * construction — a handle can only ever be put on a value the slider has, while a keyboard can ask
 * for anything at all — so these cover what the app makes of what was typed:
 *
 * - that a value between two steps is taken **down** to a step rather than to the nearer one
 * - that a value outside the slider's bounds is held to them
 * - that anything which is not a number leaves the setting alone entirely
 * - that what is shown is the value at the precision the setting actually has
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import RangeValueUtil from "../../../src/client/ui/util/rangeValueUtil";

// A lamp's two dials, which are the sliders these rules were written for: a short run of whole
// values, each of them a real quantity (see LampLightUtil).
const LAMP_INTENSITY = {min: 1, max: 12, step: 1};
// The camera's zoom, at the other extreme: a hundred steps of a hundredth each.
const ZOOM = {min: 0, max: 1, step: 0.01};

function parse(typed: string, slider: {min: number, max: number, step: number}): number | null
{
    return RangeValueUtil.parse(typed, slider.min, slider.max, slider.step);
}

describe("a slider value that was typed rather than dragged", () => {
    it("takes a value between two steps down to the step below it", () => {
        // Down rather than to the nearer one, so that typing a number never quietly asks for more
        // than was typed — a lamp told to reach 9 blocks must not come back reaching ten.
        expect(parse("9.9", LAMP_INTENSITY)).toBe(9);
        expect(parse("9.1", LAMP_INTENSITY)).toBe(9);
        expect(parse("0.549", ZOOM)).toBeCloseTo(0.54, 6);
    });

    it("leaves a value that is already a step exactly where it is", () => {
        // The grid is walked by repeated addition in floating point, so a value that is exactly a
        // step can land a hair below it — and a step taken down a step is the one way this rule
        // could turn a slider that was dragged into one that drifts.
        for (let value = LAMP_INTENSITY.min; value <= LAMP_INTENSITY.max; value++)
            expect(parse(String(value), LAMP_INTENSITY)).toBe(value);

        for (let i = 0; i <= 100; i++)
        {
            const value = i / 100;
            expect(parse(String(value), ZOOM)).toBeCloseTo(value, 6);
        }
    });

    it("holds a value outside the slider to the slider", () => {
        expect(parse("1000", LAMP_INTENSITY)).toBe(LAMP_INTENSITY.max);
        expect(parse("-5", LAMP_INTENSITY)).toBe(LAMP_INTENSITY.min);
        expect(parse("2", ZOOM)).toBe(ZOOM.max);
    });

    it("asks nothing at all of the slider when what was typed is not a number", () => {
        // The field is typed into a character at a time, so most of what it holds mid-word is not a
        // value — and neither is the empty field a Backspace leaves behind. None of it may move the
        // handle: what the user is looking at is the setting, and the setting was never changed.
        for (const typed of ["", "   ", "-", ".", "abc", "3 blocks", "1,5", "NaN", "Infinity"])
            expect(parse(typed, LAMP_INTENSITY)).toBeNull();
    });

    it("never hands back a value the slider does not have", () => {
        fc.assert(fc.property(fc.string({maxLength: 8}), (typed) => {
            const value = parse(typed, LAMP_INTENSITY);
            if (value === null)
                return;
            expect(value).toBeGreaterThanOrEqual(LAMP_INTENSITY.min);
            expect(value).toBeLessThanOrEqual(LAMP_INTENSITY.max);
            expect(Number.isInteger(value)).toBe(true);
        }));
    });

    it("writes a value out at the precision the setting has, and no further", () => {
        // A setting counted in whole steps is written as a whole number rather than padded out to a
        // precision it does not have, and one that is genuinely fractional is cut to a single digit
        // — the number stands beside the handle in a form's row, where anything longer is noise.
        expect(RangeValueUtil.format("12")).toBe("12");
        expect(RangeValueUtil.format("0.55")).toBe("0.6");
        expect(RangeValueUtil.format("0.5400000000000001")).toBe("0.5");
        expect(RangeValueUtil.format("93")).toBe("93");
    });

    it("hands back anything that is not a number untouched", () => {
        // Writing a value out is only ever asked of the slider's own value, which is always a
        // number — so the one thing this must not do with something else is invent a number for it.
        expect(RangeValueUtil.format("")).toBe("");
        expect(RangeValueUtil.format("-")).toBe("-");
        expect(RangeValueUtil.format("abc")).toBe("abc");
    });
});
