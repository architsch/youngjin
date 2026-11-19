import { useState } from "react";
import FieldValueUtil from "../util/fieldValueUtil";

// A palette color. Hovering a swatch tries it on (the thumbnails redraw), clicking one keeps it.
export default function ColorControl({ options, value, allowIndeterminate, onChange, onPreview }: Props)
{
    const [open, setOpen] = useState(false);
    const index = FieldValueUtil.findOption(options, value);
    const isIndeterminate = FieldValueUtil.isIndeterminate(value);
    const isColor = value != undefined && typeof value == "object" && [value.x, value.y, value.z].every(Number.isFinite);

    let valueText = "not a color";
    if (isIndeterminate)
        valueText = "set by the object";
    else if (isColor)
        valueText = FieldValueUtil.toHex(value);

    return <div className="color-control">
        <button type="button" className="color-button" onClick={() => setOpen(!open)} aria-expanded={open}>
            <span className={`swatch${isIndeterminate ? " indeterminate" : ""}`}
                style={isColor && !isIndeterminate ? {background: FieldValueUtil.toHex(value)} : undefined} />
            <span className="color-value">{valueText}</span>
            <span className={`color-index${index < 0 && !isIndeterminate ? " off-palette" : ""}`}>
                {index >= 0 ? `palette #${index}` : isIndeterminate ? "" : "not in the palette"}
            </span>
            <span className="chevron" aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
        {open && <div className="palette" onMouseLeave={() => onPreview(undefined)}>
            {allowIndeterminate && <button type="button"
                className={`palette-swatch indeterminate${isIndeterminate ? " selected" : ""}`}
                title="Set by the object after decoding (-1 in every channel)"
                onMouseEnter={() => onPreview(FieldValueUtil.getIndeterminateColor())}
                onClick={() => onChange(FieldValueUtil.getIndeterminateColor())} />}
            {options.map((option, i) => <button type="button" key={i}
                className={`palette-swatch${i == index ? " selected" : ""}`}
                style={{background: FieldValueUtil.toHex(option)}}
                title={`${FieldValueUtil.toHex(option)} · palette #${i}`}
                onMouseEnter={() => onPreview(option)}
                onFocus={() => onPreview(option)}
                onBlur={() => onPreview(undefined)}
                onClick={() => onChange(option)} />)}
        </div>}
    </div>;
}

interface Props
{
    options: any[]; // RGB vectors, in palette order
    value: any;
    allowIndeterminate: boolean;
    onChange: (value: any) => void;
    onPreview: (value: any | undefined) => void;
}
