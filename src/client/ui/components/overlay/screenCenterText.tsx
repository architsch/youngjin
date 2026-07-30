import { ReactNode } from "react";

// The font size and the padding both scale with the viewport width (clamped between a
// readable minimum and the desktop-sized maximum), so a long single-word message such as
// "Reconnecting..." still fits within the max-width on a narrow portrait phone screen
// instead of being clipped. `break-normal` keeps the message wrapping only at spaces.
const baseClassNames = "absolute top-0 bottom-0 left-0 right-0 m-auto p-[clamp(0.75rem,3vw,2.5rem)] max-w-11/12 w-fit h-fit rounded-4xl text-[clamp(1.25rem,5vw,2.25rem)] text-center break-normal pointer-events-none";

// A message held in the middle of the screen while the app is busy, optionally with something of
// its own (e.g. a progress bar) underneath it.
//
// The message never stops dimming and brightening. That is the whole point of it: these messages
// go up in front of work that can occupy the main thread for seconds at a time, and a caption
// sitting perfectly still in front of a frozen scene is indistinguishable from a hung app. The
// oscillation animates opacity alone, which the browser runs off the main thread, so the message
// keeps breathing even while nothing else on the page can move.
export default function ScreenCenterText(props: {text: string, customClassNames: string, children?: ReactNode})
{
    return <div className={`${baseClassNames} ${props.customClassNames}`}>
        <span className="inline-block animate-status-breathe">
            {props.text}
        </span>
        {props.children}
    </div>;
}
