import { useEffect, useState } from "react";
import { screenArrowTargetObservable } from "../../../system/clientObservables";
import useTrackedElementRect from "../../util/trackedElementRect";

const ARROW_GAP_PX = 8; // gap between the arrow's tip and the edge of the target it points at

// Bouncing 2D arrow pointing at a DOM element (screenArrowTargetObservable), from above by default or
// from below for top-of-screen targets. Tracks the element.
export default function ScreenArrow()
{
    const [arrowParams, setArrowParams] = useState<{targetElementId: string,
        arrowBias: "center" | "left" | "right", arrowSide: "above" | "below"} | null>(null);

    useEffect(() => {
        screenArrowTargetObservable.addListener("ui.screenArrow", setArrowParams);
        return () => screenArrowTargetObservable.removeListener("ui.screenArrow");
    }, []);

    const rect = useTrackedElementRect(arrowParams?.targetElementId ?? null);
    if (!arrowParams || !rect)
        return null;

    let left = rect.left;
    switch (arrowParams.arrowBias)
    {
        case "left": left += rect.width * 0.25; break;
        case "center": left += rect.width * 0.5; break;
        case "right": left += rect.width * 0.75; break;
        default: throw new Error(`Unknown arrowBias :: ${arrowParams.arrowBias}`);
    }

    const pointsDown = arrowParams.arrowSide != "below";
    const top = pointsDown ? rect.top - ARROW_GAP_PX : rect.bottom + ARROW_GAP_PX;

    return <div className={`absolute z-50 w-14 h-14 -translate-x-1/2 animate-bounce-strong pointer-events-none drop-shadow-lg ${pointsDown ? "-translate-y-full" : ""}`}
        style={{ left: left, top: top }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
            className={`w-full h-full text-amber-400 ${pointsDown ? "" : "rotate-180"}`}>
            <line x1="12" y1="3" x2="12" y2="18"/>
            <path d="M6 12 L12 19 L18 12"/>
        </svg>
    </div>;
}
