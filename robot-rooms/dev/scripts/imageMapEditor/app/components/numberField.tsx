// A number typed in, kept within its range; beside a slider, for a value set exactly.
export default function NumberField({ value, min, max, step, onChange }: Props)
{
    return <input type="number" className="number-field" min={min} max={max} step={step} value={value}
        onChange={ev => {
            if (Number.isFinite(ev.target.valueAsNumber))
                onChange(Math.min(max, Math.max(min, ev.target.valueAsNumber)));
        }}/>;
}

interface Props
{
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
}
