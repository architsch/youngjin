// An on/off switch: a sunken track with a raised knob, between the words for its two sides (see the depth rules in
// input.css), the one it is at lit.
export default function ToggleSwitchInput({id, checked, onChange, offLabel = "Off", onLabel = "On", disabled = false,
    additionalClassNames = ""}: Props)
{
    // A div, so its role and state are declared for assistive tech.
    return <div
        id={id}
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        className={`flex flex-row items-center gap-2 shrink-0 select-none touch-manipulation ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${additionalClassNames}`}
        onClick={disabled ? undefined : () => onChange(!checked)}
    >
        <span className={`yj-text-sm transition-colors duration-200 ${checked ? "text-gray-500" : "text-gray-200"}`}>{offLabel}</span>
        <div className={`relative w-11 h-6 shrink-0 rounded-full border-2 border-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-colors duration-200 ${checked ? "bg-green-300" : "bg-gray-500"}`}>
            <div className={`absolute top-0.5 left-0.5 size-4 rounded-full border border-black bg-linear-to-b from-white to-gray-400 shadow-[0_1px_2px_rgba(0,0,0,0.6)] transition-transform duration-200 ease-out ${checked ? "translate-x-5" : "translate-x-0"}`}/>
        </div>
        <span className={`yj-text-sm transition-colors duration-200 ${checked ? "text-green-300" : "text-gray-500"}`}>{onLabel}</span>
    </div>;
}

interface Props
{
    id?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    offLabel?: string;
    onLabel?: string;
    // Shown but not changeable, e.g. where this user may not make the edit.
    disabled?: boolean;
    additionalClassNames?: string;
}
