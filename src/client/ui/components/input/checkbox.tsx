export default function Checkbox({label, size = "md", checked, onChange}: Props)
{
    return <label className={`flex flex-row items-center gap-1 cursor-pointer ${textClassNames[size]}`}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
    </label>
}

const textClassNames = {
    xs: "yj-text-xs",
    sm: "yj-text-sm",
    md: "yj-text-md",
    lg: "yj-text-lg",
};

interface Props
{
    label: string;
    size?: "xs" | "sm" | "md" | "lg";
    checked: boolean;
    onChange: (checked: boolean) => void;
}
