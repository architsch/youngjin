import { ReactNode } from "react";

// A non-pressable icon: a fixed square the drawing fits into (like IconButton's, without the raised
// face or cursor). Inherits its colour from its container.

export default function Icon({ icon, size = "md", additionalClassNames = "", id }: Props)
{
    return <div
        id={id}
        className={`flex items-center justify-center shrink-0 select-none ${sizeClassNames[size]} ${additionalClassNames}`}
    >
        {icon}
    </div>
}

// Same size steps as iconButton.tsx, measured to the drawing (no button padding).
const sizeClassNames = {
    xs: "size-3.5",
    sm: "size-5",
    md: "size-7",
    lg: "size-10",
};

interface Props
{
    icon: ReactNode;
    size?: "xs" | "sm" | "md" | "lg";
    additionalClassNames?: string;
    id?: string;
}
