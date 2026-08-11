import { ReactNode } from "react";

//------------------------------------------------------------------------
// An icon standing on its own, in the way IconButton draws one inside a button: a fixed square
// the drawing is fitted into, so that a set of icons lines up whatever each of them draws.
//
// Nothing here can be pressed. The raised face and the cursor an IconButton wears are what say a
// thing answers a press, and an icon that is only labelling something must not make that promise —
// so this keeps the size steps and nothing else. It takes its colour from whatever it sits in,
// which lets the same icon read correctly inside a button, on a panel, or over the 3D scene.
//------------------------------------------------------------------------

export default function Icon({ icon, size = "md", additionalClassNames = "", id }: Props)
{
    return <div
        id={id}
        className={`flex items-center justify-center shrink-0 select-none ${sizeClassNames[size]} ${additionalClassNames}`}
    >
        {icon}
    </div>
}

// The steps of iconButton.tsx, measured to the drawing rather than to the button around it: an icon
// on its own has no panel to be held off the edge of, so the square here is the one the padding
// there leaves inside itself, and an icon beside a button of the same step reads at the same size.
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
