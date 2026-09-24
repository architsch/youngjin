export default function ToggleControl({ value, onChange }: Props)
{
    return <label className="toggle">
        <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
        <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
        <span className="toggle-text">{value ? "true" : "false"}</span>
    </label>;
}

interface Props
{
    value: boolean;
    onChange: (value: boolean) => void;
}
