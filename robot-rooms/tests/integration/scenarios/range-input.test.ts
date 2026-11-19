/**
 * Scenario tests: typed slider values (see RangeValueInput) — floored to a step, clamped to bounds,
 * ignored when not a number, and displayed at the setting's precision.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import RangeValueUtil from "../../../src/client/ui/util/rangeValueUtil";

// A lamp's dials (see LampLightUtil).
const LAMP_INTENSITY = {min: 1, max: 12, step: 1};
// The camera's zoom, at the other extreme: a hundred steps of a hundredth each.
const ZOOM = {min: 0, max: 1, step: 0.01};

function parse(typed: string, slider: {min: number, max: number, step: number}): number | null
{
    return RangeValueUtil.parse(typed, slider.min, slider.max, slider.step);
}

describe("a slider value that was typed rather than dragged", () => {
    it("takes a value between two steps down to the step below it", () => {
        // Floor, not round, so typing never asks for more than was typed.
        expect(parse("9.9", LAMP_INTENSITY)).toBe(9);
        expect(parse("9.1", LAMP_INTENSITY)).toBe(9);
        expect(parse("0.549", ZOOM)).toBeCloseTo(0.54, 6);
    });

    it("leaves a value that is already a step exactly where it is", () => {
        // Stepping by float addition can land just below a step; flooring must not drop it a step.
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
        // Partial or empty input must not move the handle.
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
        // Whole-step settings show integers; fractional ones a single decimal.
        expect(RangeValueUtil.format("12")).toBe("12");
        expect(RangeValueUtil.format("0.55")).toBe("0.6");
        expect(RangeValueUtil.format("0.5400000000000001")).toBe("0.5");
        expect(RangeValueUtil.format("93")).toBe("93");
    });

    it("hands back anything that is not a number untouched", () => {
        // Only numbers are formatted; a non-number must not become one.
        expect(RangeValueUtil.format("")).toBe("");
        expect(RangeValueUtil.format("-")).toBe("-");
        expect(RangeValueUtil.format("abc")).toBe("abc");
    });
});
