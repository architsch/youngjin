import Text from "../basic/text";

// Label stacked above the box, so it takes no more width than its label, or beside it, to sit in a row of tools as high
// as the box.
export default function Checkbox({id, label, size = "md", checked, onChange, labelPosition = "above", disabled = false,
    additionalClassNames = ""}: Props)
{
    const beside = labelPosition == "left";
    return <label className={`flex ${beside ? "flex-row" : "flex-col"} items-center gap-1 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${additionalClassNames}`}>
        <Text content={label} size={size} additionalClassNames={beside ? "shrink-0" : ""}/>
        <input id={id} type="checkbox" className={`w-7 h-7 ${beside ? "shrink-0" : "mb-2"} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
}

interface Props
{
    id?: string;
    label: string;
    size?: "xs" | "sm" | "md" | "lg";
    checked: boolean;
    onChange: (checked: boolean) => void;
    // Defaults to "above".
    labelPosition?: "above" | "left";
    // Shown but not changeable, e.g. where this user may not make the edit.
    disabled?: boolean;
    additionalClassNames?: string;
}
