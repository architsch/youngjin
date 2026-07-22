// The font size and the padding both scale with the viewport width (clamped between a
// readable minimum and the desktop-sized maximum), so a long single-word message such as
// "Reconnecting..." still fits within the max-width on a narrow portrait phone screen
// instead of being clipped. `break-normal` keeps the message wrapping only at spaces.
const baseClassNames = "absolute top-0 bottom-0 left-0 right-0 m-auto p-[clamp(0.75rem,3vw,2.5rem)] max-w-11/12 w-fit h-fit rounded-4xl text-[clamp(1.25rem,5vw,2.25rem)] text-center break-normal pointer-events-none";

export default function ScreenCenterText(props: {text: string, customClassNames: string})
{
    return <div className={`${baseClassNames} ${props.customClassNames}`}>
        {props.text}
    </div>;
}