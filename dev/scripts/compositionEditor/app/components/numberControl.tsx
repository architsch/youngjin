import { KeyboardEvent, useState } from "react";
import FieldValueUtil from "../util/fieldValueUtil";

// A slider over the values the codec can store, and a box for typing one. Up and down arrows in the box step
// to the next stored value; a typed value between them is kept as typed, and flagged.
export default function NumberControl({ values, value, onChange }: Props)
{
    const [draft, setDraft] = useState<string | null>(null);
    const isNumber = typeof value == "number" && Number.isFinite(value);
    const nearestIndex = isNumber ? FieldValueUtil.getNearestNumberIndex(values, value) : 0;
    const isStored = isNumber && values[nearestIndex] == value;

    const step = (direction: 1 | -1) => {
        const next = direction > 0
            ? values.find(candidate => !isNumber || candidate > value)
            : [...values].reverse().find(candidate => !isNumber || candidate < value);
        if (next != undefined)
            onChange(next);
    };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key != "ArrowUp" && event.key != "ArrowDown")
            return;
        event.preventDefault();
        setDraft(null);
        step(event.key == "ArrowUp" ? 1 : -1);
    };

    return <div className="number-control">
        <input type="range" className="slider" min={0} max={Math.max(0, values.length - 1)} step={1}
            value={nearestIndex} disabled={values.length < 2}
            onChange={(event) => {
                setDraft(null);
                onChange(values[Number(event.target.value)]);
            }} />
        <input type="text" inputMode="decimal" className={`number-input${isStored ? "" : " off-grid"}`}
            value={draft ?? (isNumber ? String(value) : "")}
            onChange={(event) => {
                setDraft(event.target.value);
                const typed = Number(event.target.value);
                if (event.target.value.trim() != "" && Number.isFinite(typed))
                    onChange(typed);
            }}
            onBlur={() => setDraft(null)}
            onKeyDown={onKeyDown} />
        {!isStored && isNumber && <span className="field-hint">nearest stored: {values[nearestIndex]}</span>}
    </div>;
}

interface Props
{
    values: number[]; // ascending
    value: any;
    onChange: (value: number) => void;
}
