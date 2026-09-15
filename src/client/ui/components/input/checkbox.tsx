import Text from "../basic/text";

// Label stacked above the box, so it takes no more width than its label.
export default function Checkbox({label, size = "md", checked, onChange, additionalClassNames = ""}: Props)
{
    return <label className={`flex flex-col items-center gap-1 cursor-pointer ${additionalClassNames}`}>
        <Text content={label} size={size}/>
        <input type="checkbox" className="w-7 h-7 mb-2 cursor-pointer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
}

interface Props
{
    label: string;
    size?: "xs" | "sm" | "md" | "lg";
    checked: boolean;
    onChange: (checked: boolean) => void;
    additionalClassNames?: string;
}
