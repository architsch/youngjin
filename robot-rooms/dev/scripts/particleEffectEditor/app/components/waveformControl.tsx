import Waveform from "../../../../../src/shared/math/types/waveform";
import { WaveformShape } from "../../../../../src/shared/math/types/waveformShape";
import ChoiceControl from "./choiceControl";
import NumberBox from "./numberBox";

// An emitter's level over time (see Waveform), which scales its rate and speed: steady, swelling and
// easing (sine), or in bursts (pulse). A constant holds at its high level.
export default function WaveformControl({ value, onChange }: Props)
{
    const set = (change: Partial<Waveform>) => onChange({...value, ...change});
    const setShape = (shape: WaveformShape) => set((shape == "constant")
        ? {shape, low: value.high, frequency: 0}
        : {shape, low: (value.shape == "constant") ? 0 : value.low, frequency: value.frequency || 0.5});

    return <div className="waveform-control">
        <ChoiceControl options={["constant", "sine", "pulse"]} value={value.shape}
            onChange={(shape) => setShape(shape as WaveformShape)} />
        <div className="waveform-values">
            {(value.shape == "constant")
                ? <label>level <NumberBox value={value.high} step={0.05}
                    onChange={(level) => set({low: level, high: level})} /></label>
                : <>
                    <label>low <NumberBox value={value.low} step={0.05} onChange={(low) => set({low})} /></label>
                    <label>high <NumberBox value={value.high} step={0.05} onChange={(high) => set({high})} /></label>
                    <label>Hz <NumberBox value={value.frequency} step={0.05}
                        onChange={(frequency) => set({frequency: Math.max(0, frequency)})} /></label>
                    {value.shape == "pulse" && <label>duty <NumberBox value={value.duty} step={0.05}
                        onChange={(duty) => set({duty: Math.min(1, Math.max(0.01, duty))})} /></label>}
                </>}
        </div>
    </div>;
}

interface Props
{
    value: Waveform;
    onChange: (value: Waveform) => void;
}
