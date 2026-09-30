import NumberUtil from "../util/numberUtil";
import NumberBox from "./numberBox";

// A slider over the usual values, and a box for any value.
export default function NumberControl({ value, min, max, step, unit, onChange }: Props)
{
    const decimals = NumberUtil.getDecimals(step);
    return <div className="number-control">
        <input type="range" className="slider" min={min} max={max} step={step}
            value={NumberUtil.clamp(Number.isFinite(value) ? value : min, min, max)}
            onChange={(event) => onChange(NumberUtil.round(Number(event.target.value), decimals))} />
        <NumberBox value={value} step={step} outside={value < min || value > max} onChange={onChange} />
        <span className="unit">{unit ?? ""}</span>
    </div>;
}

interface Props
{
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    onChange: (value: number) => void;
}
