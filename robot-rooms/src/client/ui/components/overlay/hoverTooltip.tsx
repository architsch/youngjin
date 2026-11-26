import { useCallback, useEffect, useState } from "react";
import TooltipPanel from "./tooltipPanel";

// How long a mouse rests on the control before its tooltip shows, so that one passing over it raises none.
const DELAY_MS = 300;

// A TooltipPanel shown while a mouse rests on the control it hangs off (by DOM id). Never for a finger or a pen.
export default function HoverTooltip({targetElementId, text}: Props)
{
    const [shown, setShown] = useState(false);
    const hide = useCallback(() => setShown(false), []);

    useEffect(() => {
        const target = document.getElementById(targetElementId);
        if (!target)
            return;
        let timeout: number | undefined;
        const enter = (event: PointerEvent) => {
            if (event.pointerType == "mouse")
                timeout = window.setTimeout(() => setShown(true), DELAY_MS);
        };
        const leave = () => {
            window.clearTimeout(timeout);
            setShown(false);
        };
        target.addEventListener("pointerenter", enter);
        target.addEventListener("pointerleave", leave);
        return () => {
            window.clearTimeout(timeout);
            target.removeEventListener("pointerenter", enter);
            target.removeEventListener("pointerleave", leave);
        };
    }, [targetElementId]);

    return shown ? <TooltipPanel targetElementId={targetElementId} text={text} onDismiss={hide}/> : null;
}

interface Props
{
    targetElementId: string; // DOM element id of the control the tooltip hangs off
    text: string; // what the tooltip says
}
