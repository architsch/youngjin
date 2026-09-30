import { ChangeEvent, CSSProperties } from "react";
import NumberUtil from "../util/numberUtil";
import NumberBox from "./numberBox";

// A [min, max] pair, each particle drawing its value between them: two thumbs on one track, and a box for
// each. Moving one past the other carries the other along, so the pair never runs backwards.
export default function RangeControl({ value, min, max, step, unit, onChange }: Props)
{
    const [low, high] = value;
    const decimals = NumberUtil.getDecimals(step);
    const setLow = (next: number) => onChange([next, Math.max(next, high)]);
    const setHigh = (next: number) => onChange([Math.min(low, next), next]);
    const snap = (event: ChangeEvent<HTMLInputElement>) => NumberUtil.round(Number(event.target.value), decimals);
    const toPercent = (v: number) => `${(NumberUtil.clamp(v, min, max) - min) / (max - min) * 100}%`;
    const isOutside = (v: number) => v < min || v > max;
    // Two thumbs at one spot can always be parted: the one nearer its own end of the track lies on top.
    const lowOnTop = low > min + 0.5 * (max - min);

    return <div className="range-control">
        <div className="dual-slider" style={{"--from": toPercent(low), "--to": toPercent(high)} as CSSProperties}>
            <input type="range" className={lowOnTop ? "on-top" : ""} min={min} max={max} step={step}
                value={NumberUtil.clamp(low, min, max)} aria-label="From" onChange={(event) => setLow(snap(event))} />
            <input type="range" min={min} max={max} step={step}
                value={NumberUtil.clamp(high, min, max)} aria-label="To" onChange={(event) => setHigh(snap(event))} />
        </div>
        <NumberBox value={low} step={step} label="From" outside={isOutside(low)} onChange={setLow} />
        <NumberBox value={high} step={step} label="To" outside={isOutside(high)} onChange={setHigh} />
        <span className="unit">{unit ?? ""}</span>
    </div>;
}

interface Props
{
    value: [number, number];
    min: number;
    max: number;
    step: number;
    unit?: string;
    onChange: (value: [number, number]) => void;
}
