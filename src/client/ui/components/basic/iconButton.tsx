import { ReactNode } from "react";

export default function IconButton({icon, size = "md", color = "gray", disabled = false, onClick, additionalClassNames = "" }: Props)
{
    return <div
        className={`flex items-center justify-center shrink-0 ${disabled ? "" : "cursor-pointer"} ${sizeClassNames[size]} ${disabled ? panelClassNames["disabled"] : panelClassNames[color]} ${additionalClassNames}`}
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

interface Props
{
    icon: ReactNode;
    size?: "xs" | "sm" | "md" | "lg";
    color?: "gray" | "green" | "red" | "transparent";
    disabled?: boolean;
    onClick: () => void;
    additionalClassNames?: string;
}
