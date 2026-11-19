import NumberField from "./numberField";

// A labeled slider with the number beside it; a reset puts it back at its default.
export default function SliderRow({ label, min, max, step, value, unit, title, defaultValue, onChange }: Props)
{
    return <div className="slider-row" title={title}>
        <span className="slider-label">{label}</span>
        <input type="range" min={min} max={max} step={step} value={value}
            onChange={ev => onChange(ev.target.valueAsNumber)}/>
        <NumberField value={value} min={min} max={max} step={step} onChange={onChange}/>
        {unit && <span className="panel-note">{unit}</span>}
        {defaultValue != undefined && <button type="button" className="button small" disabled={value == defaultValue}
            onClick={() => onChange(defaultValue)}>Reset</button>}
    </div>;
}

interface Props
{
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    unit?: string;
    title?: string;
    defaultValue?: number;
    onChange: (value: number) => void;
}
