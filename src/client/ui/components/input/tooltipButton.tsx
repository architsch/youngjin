import { useCallback, useState } from "react";
import CompactIconButton from "./compactIconButton";
import TooltipPanel from "../overlay/tooltipPanel";
import QuestionMarkIcon from "../../svg/icons/questionMarkIcon";

// A "?" button toggling a TooltipPanel. Owns its open state (the next click anywhere dismisses it, so
// only one is ever open). The panel is viewport-fixed, so row scrolling can't clip it.
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
