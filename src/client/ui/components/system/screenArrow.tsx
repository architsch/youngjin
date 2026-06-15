import { useEffect, useState } from "react";
import { screenArrowTargetObservable } from "../../../system/clientObservables";
import useTrackedElementRect from "../../util/trackedElementRect";

const ARROW_GAP_PX = 8; // gap between the arrow's tip and the target's top edge

// A 2D arrow overlay that hovers just above a target UI element and points down at it,
// bouncing to draw attention. The target is identified by its DOM element id, which is
// supplied via screenArrowTargetObservable; the arrow tracks the element as it moves.
export default function ScreenArrow()
{
    const [arrowParams, setArrowParams] = useState<{targetElementId: string, arrowBias: "center" | "left" | "right"} | null>(null);

    useEffect(() => {
        screenArrowTargetObservable.addListener("ui.screenArrow", setArrowParams);
        return () => screenArrowTargetObservable.removeListener("ui.screenArrow");
    }, []);

    const rect = useTrackedElementRect(arrowParams?.targetElementId ?? null);
    if (!arrowParams || !rect)
        return null;

    let left = rect.left;
    switch (arrowParams?.arrowBias)
    {
        case "left": left += rect.width * 0.25; break;
        case "center": left += rect.width * 0.5; break;
        case "right": left += rect.width * 0.75; break;
        default: throw new Error(`Unknown arrowBias :: ${arrowParams?.arrowBias}`);
    }

    return <div className="absolute z-50 w-14 h-14 -translate-x-1/2 -translate-y-full animate-bounce-strong pointer-events-none drop-shadow-lg"
        style={{ left: left, top: rect.top - ARROW_GAP_PX }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-amber-400">
            <line x1="12" y1="3" x2="12" y2="18"/>
            <path d="M6 12 L12 19 L18 12"/>
        </svg>
    </div>;
}
