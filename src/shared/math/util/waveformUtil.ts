import Waveform from "../types/waveform";

const TAU = 2 * Math.PI;
// A pulse narrower than this would divide by almost nothing.
const MIN_DUTY = 0.01;

// A Waveform's level, and the level accumulated over time (its integral), both in closed form so a spin
// that follows a varying speed can be computed from the clock alone. waveformGLSL mirrors these
// formulas; the two must stay in step.
const WaveformUtil =
{
    constant: (level: number): Waveform =>
    {
        return {shape: "constant", low: level, high: level, frequency: 0, phase: 0, duty: 1};
    },
    // Where in its range the waveform stands at time t: 0 at its low level, 1 at its high level.
    getShapeValue: (waveform: Waveform, t: number): number =>
    {
        return getShapeValueAt(waveform, waveform.frequency * t + waveform.phase);
    },
    getLevel: (waveform: Waveform, t: number): number =>
    {
        return waveform.low + (waveform.high - waveform.low) * WaveformUtil.getShapeValue(waveform, t);
    },
    // The level accumulated from t0 to t1, e.g. how many turns a sprite spinning at this rate makes.
    integrate: (waveform: Waveform, t0: number, t1: number): number =>
    {
        return waveform.low * (t1 - t0) +
            (waveform.high - waveform.low) * integrateShape(waveform, t0, t1);
    },
    equals: (a: Waveform, b: Waveform): boolean =>
    {
        return a.shape === b.shape && a.low === b.low && a.high === b.high &&
            a.frequency === b.frequency && a.phase === b.phase && a.duty === b.duty;
    },
}

function getShapeValueAt(waveform: Waveform, x: number): number
{
    switch (waveform.shape)
    {
        case "constant":
            return 1;
        case "sine":
            return 0.5 + 0.5 * Math.sin(TAU * fract(x));
        case "pulse":
        {
            const duty = getDuty(waveform);
            const y = fract(x);
            return (y < duty) ? 0.5 - 0.5 * Math.cos(TAU * y / duty) : 0;
        }
        default:
            throw new Error(`Unknown waveform shape (shape = ${waveform.shape})`);
    }
}

function integrateShape(waveform: Waveform, t0: number, t1: number): number
{
    const frequency = waveform.frequency;
    if (waveform.shape === "constant")
        return t1 - t0;
    // A frozen waveform holds whatever value its phase gives.
    if (frequency <= 0)
        return (t1 - t0) * getShapeValueAt(waveform, waveform.phase);

    const x0 = frequency * t0 + waveform.phase;
    const x1 = frequency * t1 + waveform.phase;
    switch (waveform.shape)
    {
        case "sine":
            return 0.5 * (t1 - t0) +
                (Math.cos(TAU * fract(x0)) - Math.cos(TAU * fract(x1))) / (2 * TAU * frequency);
        case "pulse":
        {
            // Whole cycles contribute half the duty each; the partial cycles at either end are added in.
            const duty = getDuty(waveform);
            const wholeCycles = Math.floor(x1) - Math.floor(x0);
            return (wholeCycles * 0.5 * duty +
                integratePulseCycle(fract(x1), duty) - integratePulseCycle(fract(x0), duty)) / frequency;
        }
        default:
            throw new Error(`Unknown waveform shape (shape = ${waveform.shape})`);
    }
}

// The pulse's integral from the start of a cycle to y (a fraction of the cycle).
function integratePulseCycle(y: number, duty: number): number
{
    if (y >= duty)
        return 0.5 * duty;
    return 0.5 * y - duty * Math.sin(TAU * y / duty) / (2 * TAU);
}

function getDuty(waveform: Waveform): number
{
    return Math.min(1, Math.max(MIN_DUTY, waveform.duty));
}

function fract(x: number): number
{
    return x - Math.floor(x);
}

export default WaveformUtil;
