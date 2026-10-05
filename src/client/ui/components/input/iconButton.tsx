import { ReactNode } from "react";
import { ShortcutKey } from "../../types/shortcutKey";
import useShortcutKey from "../../util/shortcutKey";

export default function IconButton({icon, size = "md", color = "gray", disabled = false, highlight = false, onClick, shortcutKey, additionalClassNames = "", id }: Props)
{
    useShortcutKey(shortcutKey, onClick, !disabled);

    // A div has no `disabled`, so declare it via aria for assistive tech and automation.
    return <div
        id={id}
        aria-disabled={disabled}
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
    disabled: "yj-panel-disabled opacity-50 cursor-not-allowed",
    transparent: "pointer-events-auto",
};

// An "on" state layered over the color class.
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
    // A key whose press stands for a click on the button (see ShortcutKeyUtil).
    shortcutKey?: ShortcutKey;
    additionalClassNames?: string;
    id?: string;
}
