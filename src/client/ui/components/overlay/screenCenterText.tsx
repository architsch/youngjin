import { ReactNode } from "react";

// Font size and padding scale with viewport width (clamped), so long words like "Reconnecting..." fit
// on narrow phones; break-normal wraps only at spaces.
const baseClassNames = "absolute top-0 bottom-0 left-0 right-0 m-auto p-[clamp(0.75rem,3vw,2.5rem)] max-w-11/12 w-fit h-fit rounded-4xl text-[clamp(1.25rem,5vw,2.25rem)] text-center break-normal pointer-events-none";

// Centred busy message with optional content (e.g. a progress bar). Always pulses opacity (runs off
// the main thread), so a blocked main thread doesn't look like a hang.
export default function ScreenCenterText(props: {text: string, customClassNames: string, children?: ReactNode})
{
    return <div className={`${baseClassNames} ${props.customClassNames}`}>
        <span className="inline-block animate-status-breathe">
            {props.text}
        </span>
        {props.children}
    </div>;
}
