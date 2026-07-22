export default function Button({name, size = "md", color = "gray", disabled = false, highlight = false, onClick, additionalClassNames = "" }: Props)
{
    return <div
        className={`flex items-center justify-center text-center select-none touch-manipulation ${disabled ? "" : "cursor-pointer"} ${sizeClassNames[size]} ${disabled ? panelClassNames["disabled"] : panelClassNames[color]} ${!disabled && highlight ? highlightClassName : ""} ${additionalClassNames}`}
        onClick={disabled ? undefined : onClick}
    >
        {name}
    </div>
}

// Heights mirror the square sizes in iconButton.tsx, so buttons and icon-buttons
// line up when placed side by side in a row.
const sizeClassNames = {
    xs: "h-5 px-1.5 text-xs",
    sm: "h-7.5 px-3 text-sm",
    md: "h-10 px-4.5 text-base font-semibold",
    lg: "h-15 px-6 text-lg font-semibold",
};

const panelClassNames = {
    gray: "yj-panel-gray",
    green: "yj-panel-green",
    red: "yj-panel-red",
    disabled: "yj-panel-gray opacity-50 cursor-not-allowed",
    transparent: "pointer-events-auto",
};

// Layered on top of the color class above, so it reads as an "on" state of that
// same button rather than as a separate color.
const highlightClassName = "yj-panel-highlight";

interface Props
{
    name: string;
    size?: "xs" | "sm" | "md" | "lg";
    color?: "gray" | "green" | "red" | "transparent";
    disabled?: boolean;
    // Marks the button as currently active — e.g. a toggle whose target is open.
    highlight?: boolean;
    onClick: () => void;
    additionalClassNames?: string;
}