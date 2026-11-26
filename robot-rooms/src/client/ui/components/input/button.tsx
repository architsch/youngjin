import { ReactNode, useId } from "react";
import { ShortcutKey } from "../../types/shortcutKey";
import { ButtonMark } from "../../types/buttonMark";
import useShortcutKey from "../../util/shortcutKey";
import ButtonMarkIcon from "../../svg/icons/buttonMarkIcon";
import HoverTooltip from "../overlay/hoverTooltip";

// The buttons ScreenControlMap names are pictured in messages by hand-made copies (see ScreenControlPicture): a new
// look, or new words, a new mark or color for one of them, goes there too.
export default function Button({name, size = "md", color = "gray", disabled = false, highlight = false, onClick, shortcutKey, mark, tooltip, additionalClassNames = "", id, children }: Props)
{
    useShortcutKey(shortcutKey, onClick, !disabled);
    const ownId = useId();
    const elementId = id ?? (tooltip == undefined ? undefined : ownId);

    // Stated as well as drawn — see iconButton.tsx, which carries the reasoning for both.
    return <>
        <div
            id={elementId}
            aria-disabled={disabled}
            className={`flex items-center justify-center gap-1.5 text-center select-none touch-manipulation ${mark == undefined ? "" : "relative"} ${disabled ? "" : "cursor-pointer"} ${sizeClassNames[size]} ${disabled ? panelClassNames["disabled"] : panelClassNames[color]} ${!disabled && highlight ? highlightClassName : ""} ${additionalClassNames}`}
            onClick={disabled ? undefined : onClick}
        >
            {name}
            {children}
            {mark != undefined && <div className="absolute top-px right-px size-1.75">
                <ButtonMarkIcon mark={mark}/>
            </div>}
        </div>
        {tooltip != undefined && <HoverTooltip targetElementId={elementId!} text={tooltip}/>}
    </>;
}

// Heights match iconButton.tsx sizes so they line up in a row.
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
    disabled: "yj-panel-disabled opacity-50 cursor-not-allowed",
    transparent: "pointer-events-auto",
};

// An "on" state layered over the color class.
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
    // A key whose press stands for a click on the button (see ShortcutKeyUtil).
    shortcutKey?: ShortcutKey;
    // Drawn in its top right corner, sized for the sm size.
    mark?: ButtonMark;
    // What a box over or under it says while a mouse rests on it (see HoverTooltip).
    tooltip?: string;
    additionalClassNames?: string;
    id?: string;
    // What stands beside its name, within it (e.g. what a press costs; see PriceTag).
    children?: ReactNode;
}