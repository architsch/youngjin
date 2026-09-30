import Waveform from "../../../shared/math/types/waveform";
import { WaveformShape } from "../../../shared/math/types/waveformShape";

// The GLSL twin of WaveformUtil: a waveform's level and its integral over time, with the same formulas.
// Include-guarded, since several splices in one material may each include it.

const WAVEFORM_SHAPE_CODE: {[shape in WaveformShape]: number} = {constant: 0, sine: 1, pulse: 2};
const WAVEFORM_SHAPE_BY_CODE: WaveformShape[] = ["constant", "sine", "pulse"];
// Below one, so the duty never carries into the code.
const MAX_PACKED_DUTY = 0.999;

// Shape and duty packed into one float, as the shader unpacks them: the code, plus the duty below one.
export function packWaveformShape(waveform: Waveform): number
{
    return WAVEFORM_SHAPE_CODE[waveform.shape] + Math.min(MAX_PACKED_DUTY, Math.max(0, waveform.duty));
}

export function unpackWaveformShape(packed: number): {shape: WaveformShape, duty: number}
{
    const code = Math.floor(packed);
    return {shape: WAVEFORM_SHAPE_BY_CODE[code] ?? "constant", duty: packed - code};
}

// wave = (low, high, frequency, phase).
const WAVEFORM_GLSL = `
    #ifndef WAVEFORM_GLSL_INCLUDED
    #define WAVEFORM_GLSL_INCLUDED
    const float WAVEFORM_TAU = 6.28318530718;
    const float WAVEFORM_MIN_DUTY = 0.01;

    // 0 at the low level, 1 at the high. shape: 0 constant, 1 sine, 2 pulse.
    float waveformShapeValue(float shape, float duty, float x)
    {
        if (shape < 0.5)
            return 1.0;
        float y = fract(x);
        if (shape < 1.5)
            return 0.5 + 0.5 * sin(WAVEFORM_TAU * y);
        float d = clamp(duty, WAVEFORM_MIN_DUTY, 1.0);
        return (y < d) ? 0.5 - 0.5 * cos(WAVEFORM_TAU * y / d) : 0.0;
    }

    float waveformPulseCycleIntegral(float y, float d)
    {
        return (y >= d) ? 0.5 * d : 0.5 * y - d * sin(WAVEFORM_TAU * y / d) / (2.0 * WAVEFORM_TAU);
    }

    // The level accumulated from t0 to t1. Whole cycles are counted apart from the fractions at either
    // end, so large times don't cancel each other out.
    float waveformIntegral(vec4 wave, float shape, float duty, float t0, float t1)
    {
        float shapeIntegral;
        if (shape < 0.5)
        {
            shapeIntegral = t1 - t0;
        }
        else if (wave.z <= 0.0)
        {
            shapeIntegral = (t1 - t0) * waveformShapeValue(shape, duty, wave.w);
        }
        else
        {
            float x0 = wave.z * t0 + wave.w;
            float x1 = wave.z * t1 + wave.w;
            if (shape < 1.5)
            {
                shapeIntegral = 0.5 * (t1 - t0) + (cos(WAVEFORM_TAU * fract(x0)) -
                    cos(WAVEFORM_TAU * fract(x1))) / (2.0 * WAVEFORM_TAU * wave.z);
            }
            else
            {
                float d = clamp(duty, WAVEFORM_MIN_DUTY, 1.0);
                shapeIntegral = ((floor(x1) - floor(x0)) * 0.5 * d + waveformPulseCycleIntegral(fract(x1), d) -
                    waveformPulseCycleIntegral(fract(x0), d)) / wave.z;
            }
        }
        return wave.x * (t1 - t0) + (wave.y - wave.x) * shapeIntegral;
    }
    #endif
`;

export default WAVEFORM_GLSL;
