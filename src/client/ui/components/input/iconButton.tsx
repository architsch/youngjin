import { ReactNode } from "react";

export default function IconButton({icon, size = "md", color = "gray", disabled = false, highlight = false, onClick, additionalClassNames = "", id }: Props)
{
    return <div
        id={id}
        className={`flex items-center justify-center shrink-0 select-none touch-manipulation ${disabled ? "" : "cursor-pointer"} ${sizeClassNames[size]} ${disabled ? panelClassNames["disabled"] : panelClassNames[color]} ${!disabled && highlight ? highlightClassName : ""} ${additionalClassNames}`}
        onClick={disabled ? undefined : onClick}
    >
        {icon}
    </div>
}

const sizeClassNames = {
    xs: "size-5 p-[0.125rem]",
    sm: "size-7.5 p-[0.15rem]",
    md: "size-10 p-1.5",
    lg: "size-15 p-2.25",
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
    icon: ReactNode;
    size?: "xs" | "sm" | "md" | "lg";
    color?: "gray" | "green" | "red" | "transparent";
    disabled?: boolean;
    // Marks the button as currently active — e.g. a toggle whose target is open.
    highlight?: boolean;
    onClick: () => void;
    additionalClassNames?: string;
    id?: string;
}
