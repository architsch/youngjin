import { KeyboardEvent, useState } from "react";
import NumberUtil from "../util/numberUtil";

// A typed number, applied as soon as it parses. Up and down arrows step it, ten steps at a time with Shift.
// "outside": past the slider beside it, which is allowed but worth seeing.
export default function NumberBox({ value, step, label, outside, onChange }: Props)
{
    const [draft, setDraft] = useState<string | null>(null);
    const decimals = NumberUtil.getDecimals(step);

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key != "ArrowUp" && event.key != "ArrowDown")
            return;
        event.preventDefault();
        setDraft(null);
        const direction = (event.key == "ArrowUp") ? 1 : -1;
        const base = Number.isFinite(value) ? value : 0;
        onChange(NumberUtil.round(base + direction * step * (event.shiftKey ? 10 : 1), decimals));
    };

    return <input type="text" inputMode="decimal" aria-label={label} title={label}
        className={`number-input${outside ? " outside" : ""}`}
        value={draft ?? NumberUtil.format(value)}
        onChange={(event) => {
            setDraft(event.target.value);
            const typed = Number(event.target.value);
            if (event.target.value.trim() != "" && Number.isFinite(typed))
                onChange(typed);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={onKeyDown} />;
}

interface Props
{
    value: number;
    step: number;
    label?: string;
    outside?: boolean;
    onChange: (value: number) => void;
}
