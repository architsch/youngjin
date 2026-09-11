import { useCallback, useState } from "react";
import CompactIconButton from "./compactIconButton";
import TooltipPanel from "../overlay/tooltipPanel";
import QuestionMarkIcon from "../../svg/icons/questionMarkIcon";

// A "?" that raises a few words about whatever it stands beside, and takes them down again (see
// TooltipPanel).
//
// Whether the explanation is up is the button's own business, since nothing else ever needs to know:
// the next click anywhere takes it down, so a second explanation could only be raised by the very
// click that dismisses the first, and two are never up at once.
//
// The explanation is fixed to the viewport rather than laid out beside the button, so it neither
// takes up room in whatever row the button stands in nor gets cut off by that row's scrolling.
export default function TooltipButton({ id, text, additionalClassNames = "" }: Props)
{
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);

    return <>
        <CompactIconButton id={id} icon={<QuestionMarkIcon/>} size="md"
            onClick={() => setOpen(prev => !prev)}
            additionalClassNames={additionalClassNames}/>
        {open && <TooltipPanel targetElementId={id} text={text} onDismiss={close}/>}
    </>;
}

interface Props
{
    id: string; // DOM element id of the button, which the explanation hangs off
    text: string; // what the explanation says
    additionalClassNames?: string;
}
