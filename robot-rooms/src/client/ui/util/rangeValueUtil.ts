// Formatting and parsing rules for typed slider values (see RangeValueInput).
const RangeValueUtil =
{
    // At most one decimal, none for whole numbers. Non-numeric input is returned unchanged.
    format: (value: string): string =>
    {
        if (!isNumeric(value))
            return value;
        return String(Math.round(Number(value) * 10) / 10);
    },
    // Parses typed input to a valid slider value, or null (half-typed, empty or non-numeric) to leave
    // the handle alone. Rounds down between steps, so typing never asks for more (e.g. lamp reach).
    parse: (typed: string, min: number, max: number, step: number): number | null =>
    {
        if (!isNumeric(typed))
            return null;
        const value = Number(typed);
        if (!(step > 0))
            return clamp(value, min, max);
        // Epsilon: accumulated floating-point steps can land just under a step.
        const stepsAbove = Math.max(0, Math.floor((value - min) / step + 1e-9));
        return clamp(min + stepsAbove * step, min, max);
    },
}

// Stricter than parseFloat, which accepts "3 blocks" and treats partial input as a number.
function isNumeric(text: string): boolean
{
    return text.trim().length > 0 && Number.isFinite(Number(text));
}

function clamp(value: number, min: number, max: number): number
{
    return Math.max(min, Math.min(max, value));
}

export default RangeValueUtil;
