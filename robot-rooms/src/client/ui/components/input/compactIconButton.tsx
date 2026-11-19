import { ReactNode } from "react";

export default function CompactIconButton({icon, size = "md", onClick, additionalClassNames = "", id }: Props)
{
    return <div
        id={id}
        className={`flex items-center justify-center shrink-0 select-none touch-manipulation cursor-pointer ${sizeClassNames[size]} yj-panel-gray-compact ${additionalClassNames}`}
        onClick={onClick}
    >
        {icon}
    </div>
}

// About two thirds of iconButton.tsx sizes.
const sizeClassNames = {
    xs: "size-3.5 p-px",
    sm: "size-5 p-px",
    md: "size-6.5 p-0.5",
    lg: "size-10 p-0.5",
};

interface Props
{
    icon: ReactNode;
    size?: "xs" | "sm" | "md" | "lg";
    onClick: () => void;
    additionalClassNames?: string;
    id?: string;
}
